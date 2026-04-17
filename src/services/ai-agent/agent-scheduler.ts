import { useEffect, useRef } from 'react';
import { useAgentState } from '../../store/agent-store';
import { useAppState } from '../../store/app-store';
import { AgentRule, AgentTask } from '../../types/agent-types';
import { executeAgentTask } from './execution-driver';

export function useAgentScheduler() {
  const { state: agentState, addTask, updateRule, updateTask, addHistory } = useAgentState();
  const { state: appState } = useAppState();
  const lastCheckTime = useRef<number>(Date.now());

  useEffect(() => {
    // 10秒ごとにルールをチェックするローカルポーラー
    const interval = setInterval(() => {
      checkRulesAndGenerateTasks();
    }, 10000);

    return () => clearInterval(interval);
  }, [agentState.rules, agentState.tasks, appState]);

  const checkRulesAndGenerateTasks = () => {
    const now = new Date();
    
    agentState.rules.forEach(rule => {
      // 無効なルールはスキップ
      if (!rule.enabled) return;

      // ======================================
      // 1. Daily 実行の判定
      // ======================================
      if (rule.frequency === 'daily' && rule.execution_time) {
        const [hours, minutes] = rule.execution_time.split(':').map(Number);
        const isTimePassed = now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes);
        
        if (isTimePassed) {
          const taskExists = agentState.tasks.some(
            t => t.rule_id === rule.id && 
            new Date(t.scheduled_for).toDateString() === now.toDateString()
          );

          if (!taskExists) {
            console.log(`[Scheduler] Daily ルール発動: ${rule.name}`);
            generateTaskForRule(rule, now);
          }
        }
      }

      // ======================================
      // 2. Condition 実行判定 (価格トリガーなど)
      // ======================================
      if (rule.frequency === 'condition' || rule.strategy_type === 'condition_threshold') {
        checkConditionForRule(rule, now);
      }
    });

    lastCheckTime.current = Date.now();
  };

  const checkConditionForRule = async (rule: AgentRule, now: Date) => {
    // 安全装置: 過去24時間以内に実行されていたらスキップ (クールダウン)
    if (rule.last_executed_at) {
      const lastExecution = new Date(rule.last_executed_at);
      const hoursSinceLastExecution = (now.getTime() - lastExecution.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastExecution < 24) {
        return; // クールダウン中
      }
    }

    // すでに今日タスクが発行されてスタックしていないか防御
    const isTaskPending = agentState.tasks.some(t => t.rule_id === rule.id && t.status === 'pending_approval');
    if (isTaskPending) return;

    if (!rule.condition_target || !rule.condition_operator || rule.threshold_amount == null) {
      return; // 条件設定が不完全な場合はスキップ
    }

    // 動的インポートでオラクルを呼ぶ
    const { getLatestPriceUSD } = await import('./price-oracle');
    const currentPrice = await getLatestPriceUSD(rule.condition_target);

    if (currentPrice === null) return;
    
    // 条件の判定
    let isConditionMet = false;
    if (rule.condition_operator === '<') {
      isConditionMet = currentPrice <= rule.threshold_amount;
    } else if (rule.condition_operator === '>') {
      isConditionMet = currentPrice >= rule.threshold_amount;
    }

    if (isConditionMet) {
      console.log(`[Scheduler] 価格条件クリア！ ${rule.name} (目標: ${rule.condition_operator}${rule.threshold_amount} | 現在: ${currentPrice})`);
      generateTaskForRule(rule, now);
    }
  };

  const generateTaskForRule = async (rule: AgentRule, now: Date) => {
    // 承認モードを判定
    let isAutoExecute = false;
    if (rule.approval_mode === 'auto') {
      isAutoExecute = true;
    } else if (rule.approval_mode === 'first_5_manual' && rule.execution_count >= 5) {
      isAutoExecute = true;
    }

    // 手数料計算 (スケジューラ経由は常に自動/スケジュール実行扱い)
    const { calculateFeeBreakdown } = await import('./fee-engine');
    const feeBreakdown = calculateFeeBreakdown(rule.amount, rule.fee_config);

    // タスクを生成してキューに入れる
    const newTask: AgentTask = {
      id: `task_${Date.now()}`,
      rule_id: rule.id,
      status: isAutoExecute ? 'executed' : 'pending_approval', 
      scheduled_for: now.toISOString(),
      expected_source_amount: rule.amount,
      fee_amount: feeBreakdown.feeAmount,
      net_execution_amount: feeBreakdown.netAmount,
      expires_at: new Date(now.getTime() + 1000 * 60 * 60 * 24).toISOString(), // 1日期限
    }; 

    addTask(newTask);

    // ルールの execution_count をとりあえずスケジュール時点で更新
    const updatedRule = { ...rule, execution_count: rule.execution_count + 1, last_executed_at: now.toISOString() };
    updateRule(updatedRule);

    // オートモードの場合は即時実行
    if (isAutoExecute && appState.activeAddress) {
      console.log(`[Scheduler] オート実行モード発動！: ${rule.name}`);
      try {
        const { buildHistoryFromExecution } = await import('./execution-driver');
        const result = await executeAgentTask(
          newTask,
          rule,
          appState.settings,
          appState.activeAddress,
          appState.activeEnv as any
        );
        
        const historyEntry = buildHistoryFromExecution(newTask, rule, result);
        addHistory(historyEntry);
        
        // タスクの状態も成功/失敗に更新
        const finalStatus = result.status === 'success' ? 'executed' : 'failed';
        updateTask({ ...newTask, status: finalStatus });
        
        if (result.status === 'failed') {
          updateRule({ ...updatedRule, last_execution_status: 'failed' });
        } else {
          updateRule({ 
            ...updatedRule, 
            last_execution_status: 'success',
            total_fees_collected: (updatedRule.total_fees_collected || 0) + (result.feeAmount || 0)
          });
        }
      } catch (e) {
        console.error(`[Scheduler] 自動実行でエラー発生:`, e);
        updateTask({ ...newTask, status: 'failed' });
        updateRule({ ...updatedRule, last_execution_status: 'failed' });
      }
    }
  };
}
