// ==========================================
// AI Agent - サブコンポーネントのモック実装
// ==========================================
import { useState } from 'react';
import { useAppState } from '../../store/app-store';
import { useAgentState } from '../../store/agent-store';
import { parseIntentToRule } from '../../services/ai-agent/rule-parser';
import { normalizeTokenSymbol } from '../../services/ai-agent/token-registry';
import { AgentRule, AgentTask } from '../../types/agent-types';
import { calculateFeeBreakdown, DEFAULT_FEE_CONFIG } from '../../services/ai-agent/fee-engine';
import { SUPPORTED_TOKENS } from '../../services/ai-agent/token-registry';

// ---------------------------------------------------------
// 🛠️ ルール作成・編集用モーダル
// ---------------------------------------------------------
function RuleFormModal({ 
  rule, 
  onClose, 
  onSave 
}: { 
  rule?: Partial<AgentRule>, 
  onClose: () => void, 
  onSave: (rule: AgentRule) => void 
}) {
  const [formData, setFormData] = useState<Partial<AgentRule>>({
    name: '',
    strategy_type: 'daily_dca_swap',
    source_token: 'USDC',
    target_token: 'SUI',
    amount: 1,
    frequency: 'daily',
    execution_time: '09:00',
    approval_mode: 'first_5_manual',
    max_slippage_bps: 100,
    allowed_protocols: ['cetus', 'navi'],
    ...rule
  });

  const handleSave = () => {
    if (!formData.name || !formData.amount) return;
    
    const finalRule: AgentRule = {
      id: rule?.id || `rule_${Date.now()}`,
      name: formData.name!,
      enabled: rule?.enabled !== undefined ? rule.enabled : true,
      strategy_type: formData.strategy_type || 'daily_dca_swap',
      source_token: formData.source_token || 'USDC',
      target_token: formData.target_token || 'SUI',
      amount: formData.amount || 1,
      frequency: formData.frequency || 'daily',
      execution_time: formData.execution_time || '09:00',
      condition_target: formData.condition_target,
      condition_operator: formData.condition_operator,
      threshold_amount: formData.threshold_amount,
      approval_mode: formData.approval_mode || 'first_5_manual',
      max_slippage_bps: formData.max_slippage_bps || 100,
      daily_limit_amount: 1000,
      network: 'mainnet',
      allowed_protocols: ['navi', 'cetus'],
      execution_count: rule?.execution_count || 0,
      total_spent: rule?.total_spent || 0,
      total_fees_collected: rule?.total_fees_collected || 0,
      created_at: rule?.created_at || new Date().toISOString(),
    };

    onSave(finalRule);
  };

  return (
    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 className="card-title">{rule?.id ? '✏️ ルールを編集' : '➕ 新規ルール作成'}</h3>
        
        <div className="form-group">
          <label className="form-label">ルール名</label>
          <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="例: SUI毎日積立" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">戦略</label>
            <select className="form-input" value={formData.strategy_type} onChange={e => setFormData({...formData, strategy_type: e.target.value as any})}>
              <option value="daily_dca_swap">DCA Swap (積立)</option>
              <option value="deposit_to_navi">Deposit to Navi</option>
              <option value="condition_threshold">価格トリガー</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">承認モード</label>
            <select className="form-input" value={formData.approval_mode} onChange={e => setFormData({...formData, approval_mode: e.target.value as any})}>
              <option value="manual_only">常に手動承認</option>
              <option value="first_5_manual">最初の5回のみ手動</option>
              <option value="auto">完全自動</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">入金元トークン</label>
            <select className="form-input" value={formData.source_token} onChange={e => setFormData({...formData, source_token: e.target.value})}>
              {SUPPORTED_TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">対象トークン</label>
            <select className="form-input" value={formData.target_token} onChange={e => setFormData({...formData, target_token: e.target.value})}>
              {SUPPORTED_TOKENS.map(t => <option key={t.symbol} value={t.symbol}>{t.symbol}</option>)}
            </select>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">1回あたりの金額 ({formData.source_token})</label>
          <input type="number" className="form-input" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})} />
        </div>

        {formData.strategy_type === 'condition_threshold' ? (
          <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 16 }}>
             <label className="form-label">価格条件</label>
             <div style={{ display: 'flex', gap: 8 }}>
                <select className="form-input" style={{ width: 80 }} value={formData.condition_target} onChange={e => setFormData({...formData, condition_target: e.target.value})}>
                  <option value="SUI">SUI</option>
                  <option value="NAV">NAV</option>
                </select>
                <select className="form-input" style={{ width: 60 }} value={formData.condition_operator} onChange={e => setFormData({...formData, condition_operator: e.target.value as any})}>
                  <option value="<">≦</option>
                  <option value=">">≧</option>
                </select>
                <input type="number" className="form-input" placeholder="価格" value={formData.threshold_amount} onChange={e => setFormData({...formData, threshold_amount: parseFloat(e.target.value)})} />
                <span style={{ alignSelf: 'center' }}>USD</span>
             </div>
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">実行時間 (毎日)</label>
            <input type="time" className="form-input" value={formData.execution_time} onChange={e => setFormData({...formData, execution_time: e.target.value})} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave}>💾 保存</button>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
        </div>
      </div>
    </div>
  );
}

const AGENT_EXAMPLES = [
  { label: '💧 Cetus積立', text: '毎日 9:00 に 2 USDC を SUI に交換して積立' },
  { label: '💧 Cetusスワップ', text: '毎週月曜日に 10 USDC を CETUS に変換' },
  { label: '🛡️ Navi預入', text: '毎日 5 USDC を Navi に預け入れる (Supply)' },
  { label: '🛡️ Navi自動移動', text: 'ウォレットの SUI 残高が 100 を超えたら、超過分を Navi に移動' },
  { label: '📈 価格安で買う', text: 'SUI の価格が 0.8 ドルを下回ったら、10 USDC 分の SUI を買う' },
  { label: '💰 利益確定', text: 'SUI が 1.5 ドルを超えたら、利益確定で 5 SUI を USDC に戻す' },
];

export function AgentChatPanel() {
  const { state: appState, addToast } = useAppState();
  const { addRule } = useAgentState();
  const [input, setInput] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedRule, setParsedRule] = useState<Partial<AgentRule> | null>(null);

  const handleParse = async () => {
    if (!input.trim()) return;
    setParsing(true);
    setParsedRule(null);
    try {
      const result = await parseIntentToRule(input, appState.settings);
      
      // トークンの正規化（安全チェック）
      if (result.source_token) {
        const normSource = normalizeTokenSymbol(result.source_token);
        if (!normSource) throw new Error(`未対応のソーストークンです: ${result.source_token}`);
        result.source_token = normSource;
      }
      if (result.target_token) {
        const normTarget = normalizeTokenSymbol(result.target_token);
        if (!normTarget) throw new Error(`未対応のターゲットトークンです: ${result.target_token}`);
        result.target_token = normTarget;
      }

      setParsedRule(result);
      addToast({ type: 'success', title: '解析成功', message: 'ルール案を生成しました！確認してください。' });
    } catch (e) {
      addToast({ type: 'error', title: '解析失敗', message: String(e) });
    } finally {
      setParsing(false);
    }
  };

  const handleSaveRule = () => {
    if (!parsedRule) return;
    
    // 足りない項目を埋めて完全なルールとして保存
    const ruleToSave: AgentRule = {
      id: `rule_${Date.now()}`,
      name: input.slice(0, 20) + (input.length > 20 ? '...' : ''),
      enabled: true,
      strategy_type: parsedRule.strategy_type || 'daily_dca_swap',
      source_token: parsedRule.source_token || 'USDC',
      target_token: parsedRule.target_token || 'SUI',
      amount: parsedRule.amount || 1,
      frequency: parsedRule.frequency || 'daily',
      execution_time: parsedRule.execution_time || '09:00',
      condition_target: parsedRule.condition_target,
      condition_operator: parsedRule.condition_operator,
      threshold_amount: parsedRule.threshold_amount,
      approval_mode: parsedRule.approval_mode || 'first_5_manual',
      max_slippage_bps: parsedRule.max_slippage_bps || 100, // 1%
      daily_limit_amount: 1000,
      network: 'mainnet',
      allowed_protocols: ['navi', 'cetus'],
      execution_count: 0,
      total_spent: 0,
      created_at: new Date().toISOString(),
    };

    addRule(ruleToSave);
    addToast({ type: 'success', title: '保存完了', message: 'ルールを一覧に追加しました！' });
    
    // クリア
    setInput('');
    setParsedRule(null);
  };

  const preview = parsedRule && parsedRule.amount ? calculateFeeBreakdown(parsedRule.amount) : null;

  return (
    <div className="card">
      <h3 className="card-title">💬 エージェントに指示する</h3>
      
      {/* 例文セクション */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 8 }}>
          💡 クリックで見本を入力:
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {AGENT_EXAMPLES.map(ex => (
            <button
              key={ex.text}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '11px', padding: '4px 10px', height: 'auto' }}
              onClick={() => setInput(ex.text)}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-lg)' }}>
        <input 
          type="text" 
          className="form-input" 
          placeholder="自然文で積立ルールを入力 (例: 毎日2USDCを...)" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleParse()}
          style={{ flex: 1 }}
          disabled={parsing}
        />
        <button className="btn btn-primary" onClick={handleParse} disabled={parsing || !input}>
          {parsing ? '解析中...' : '解析'}
        </button>
      </div>

      {parsedRule && (
        <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ margin: '0 0 var(--space-md) 0', color: 'var(--color-sui)' }}>✨ ルール案が生成されました</h4>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-lg)' }}>
            <div><span style={{ color: 'var(--color-text-muted)' }}>戦略:</span> {parsedRule.strategy_type}</div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>頻度:</span> {parsedRule.frequency} ({parsedRule.execution_time})</div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>元トークン:</span> {parsedRule.source_token}</div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>先トークン:</span> {parsedRule.target_token}</div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>指定額:</span> {parsedRule.amount}</div>
            <div><span style={{ color: 'var(--color-text-muted)' }}>承認モード:</span> {parsedRule.approval_mode}</div>
          </div>
          
          {preview && (
            <div style={{ padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: 4 }}>
                <span>💰 サービス手数料 ({preview.rateBps/100}% / 自動実行時のみ)</span>
                <span style={{ color: 'var(--color-warning)' }}>- {preview.feeAmount} {parsedRule.source_token}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold' }}>
                <span>🚀 実効積立額</span>
                <span style={{ color: 'var(--color-success)' }}>{preview.netAmount} {parsedRule.source_token}</span>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', margin: '8px 0 0' }}>
                ※ 手動実行時は手数料はかかりません。
              </p>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-success" onClick={handleSaveRule}>
              💾 このルールを保存・有効化
            </button>
            <button className="btn btn-ghost" onClick={() => setParsedRule(null)}>
              キャンセル
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentRuleList() {
  const { state: agentState, updateRule, deleteRule, addRule } = useAgentState();
  const [editingRule, setEditingRule] = useState<AgentRule | null>(null);
  const [isAddingMode, setIsAddingMode] = useState(false);

  const toggleEnable = (rule: AgentRule) => {
    updateRule({ ...rule, enabled: !rule.enabled });
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <h3 className="card-title" style={{ margin: 0 }}>📋 ルール一覧</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setIsAddingMode(true)}>
          ➕ 新規作成 (フォーム)
        </button>
      </div>
      
      {agentState.rules.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
          保存済みのルールはありません。チャットから新しいルールを作成するか、新規作成ボタンを押してください。
        </p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>状態</th>
                <th>ルール名</th>
                <th>戦略</th>
                <th>内容</th>
                <th>頻度</th>
                <th>手数料率</th>
                <th>累計手数料</th>
                <th>承認モード</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {agentState.rules.map(rule => (
                <tr key={rule.id}>
                  <td>
                    <button 
                      onClick={() => toggleEnable(rule)}
                      style={{ 
                        background: rule.enabled ? 'var(--color-success)' : 'var(--color-text-muted)',
                        color: '#fff', border: 'none', padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                        fontSize: '10px', fontWeight: 'bold'
                      }}
                    >
                      {rule.enabled ? 'ON' : 'OFF'}
                    </button>
                  </td>
                  <td style={{ fontWeight: 600 }}>{rule.name}</td>
                  <td><span className="badge badge-low">{rule.strategy_type}</span></td>
                  <td>
                    {rule.amount} {rule.source_token} ➡️ {rule.target_token}
                  </td>
                  <td>{rule.frequency} ({rule.execution_time})</td>
                  <td style={{ fontSize: '11px' }}>{(rule.fee_config?.rate_bps || DEFAULT_FEE_CONFIG.rate_bps) / 100}%</td>
                  <td style={{ fontSize: '11px', color: 'var(--color-warning)' }}>
                    {rule.total_fees_collected?.toFixed(4) || '0.0000'} {rule.source_token}
                  </td>
                  <td style={{ fontSize: '10px' }}>{rule.approval_mode}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditingRule(rule)}>編集</button>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteRule(rule.id)}>削除</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 編集モーダル */}
      {editingRule && (
        <RuleFormModal 
          rule={editingRule} 
          onClose={() => setEditingRule(null)} 
          onSave={(newRule) => {
            updateRule(newRule);
            setEditingRule(null);
          }}
        />
      )}

      {/* 新規作成モーダル */}
      {isAddingMode && (
        <RuleFormModal 
          onClose={() => setIsAddingMode(false)} 
          onSave={(newRule) => {
            addRule(newRule);
            setIsAddingMode(false);
          }}
        />
      )}
    </div>
  );
}


export function AgentApprovalQueue() {
  const { state: agentState, updateTask, updateRule, addHistory } = useAgentState();
  const { state: appState, addToast } = useAppState();
  const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);

  const pendingTasks = agentState.tasks.filter(t => t.status === 'pending_approval');

  const getRuleDetails = (ruleId: string) => {
    return agentState.rules.find(r => r.id === ruleId);
  };

  const handleExecute = async (task: AgentTask, rule: AgentRule) => {
    if (executingTaskId) return;
    setExecutingTaskId(task.id);
    addToast({ type: 'info', title: '実行開始', message: `タスク ${rule.name} の実行を開始します...` });

    try {
      // 実際は execution-driver.ts を動的 import して実行する（UI スレッドをブロックしないため）
      const { executeAgentTask, buildHistoryFromExecution } = await import('../../services/ai-agent/execution-driver');
      
      const result = await executeAgentTask(task, rule, appState.settings, appState.activeAddress, appState.activeEnv as 'mainnet'|'testnet'|'devnet'|'localnet');

      // 履歴を作成
      const historyItem = buildHistoryFromExecution(task, rule, result);
      addHistory(historyItem);

      if (result.status === 'success') {
        updateTask({ ...task, status: 'executed' });
        updateRule({ 
          ...rule, 
          total_spent: rule.total_spent + result.spentAmount,
          total_fees_collected: (rule.total_fees_collected || 0) + (result.feeAmount || 0)
        });
        addToast({ type: 'success', title: '実行成功', message: `TxDigest: ${result.digest}` });
      } else {
        updateTask({ ...task, status: 'failed' });
        addToast({ type: 'error', title: '実行失敗', message: result.errorMessage || '不明なエラー' });
      }

    } catch (e) {
      updateTask({ ...task, status: 'failed' });
      addToast({ type: 'error', title: '例外発生', message: String(e) });
    } finally {
      setExecutingTaskId(null);
    }
  };

  const handleSkip = (task: AgentTask) => {
    if (confirm('このタスクをスキップして破棄しますか？')) {
      updateTask({ ...task, status: 'skipped' });
      addToast({ type: 'info', title: 'スキップ', message: 'タスクをスキップしました' });
    }
  };

  return (
    <div className="card">
      <h3 className="card-title">⏳ 承認待ちタスク ({pendingTasks.length}件)</h3>
      
      {pendingTasks.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
          現在承認待ちのタスクはありません。
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
          {pendingTasks.map(task => {
            const rule = getRuleDetails(task.rule_id);
            if (!rule) return null;

            const isExecuting = executingTaskId === task.id;

            return (
              <div key={task.id} style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', borderLeft: '4px solid var(--color-error)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)' }}>
                  <h4 style={{ margin: 0, fontSize: 'var(--text-md)' }}>{rule.name}</h4>
                  <span className="badge badge-low">{rule.strategy_type}</span>
                </div>
                
                <div style={{ fontSize: 'var(--text-md)', margin: 'var(--space-sm) 0', fontWeight: 'bold' }}>
                  {task.expected_source_amount} {rule.source_token} ➡️ {rule.target_token} (推定)
                </div>

                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span>指定額:</span>
                    <span>{task.expected_source_amount} {rule.source_token}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--color-warning)', margin: '4px 0' }}>
                    <span>サービス手数料 (3%):</span>
                    <span>- {task.fee_amount?.toFixed(4) || '0.0000'} {rule.source_token}</span>
                  </div>
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', margin: '8px 0', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>実効額:</span>
                    <span style={{ color: 'var(--color-success)' }}>{task.net_execution_amount?.toFixed(4) || '0.0000'} {rule.source_token}</span>
                  </div>
                </div>

                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                  予定日時: {new Date(task.scheduled_for).toLocaleString()}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="btn btn-primary" 
                    style={{ flex: 1 }} 
                    onClick={() => handleExecute(task, rule)}
                    disabled={executingTaskId !== null}
                  >
                    {isExecuting ? '実行中...' : '✅ 承認・実行'}
                  </button>
                  <button 
                    className="btn btn-ghost" 
                    style={{ flex: 1 }} 
                    onClick={() => handleSkip(task)}
                    disabled={executingTaskId !== null}
                  >
                    ❌ スキップ
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ...


export function AgentHistoryPanel() {
  const { state: agentState } = useAgentState();

  const getRuleDetails = (ruleId: string) => {
    return agentState.rules.find(r => r.id === ruleId);
  };

  return (
    <div className="card">
      <h3 className="card-title">📜 実行履歴 ({agentState.history.length}件)</h3>
      
      {agentState.history.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
          AIエージェントの実行履歴はまだありません。
        </p>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>実行日時</th>
                <th>ルール名</th>
                <th>アクション</th>
                <th>結果</th>
                <th>詳細</th>
              </tr>
            </thead>
            <tbody>
              {agentState.history.map(item => {
                const rule = getRuleDetails(item.rule_id);
                const ruleName = rule ? rule.name : `削除済(ID:${item.rule_id.substring(0, 8)})`;

                return (
                  <tr key={item.id}>
                    <td>{new Date(item.timestamp).toLocaleString()}</td>
                    <td>{ruleName}</td>
                    <td>{item.action_description}</td>
                    <td style={{ fontSize: '11px' }}>
                      {item.fee_amount ? (
                        <span style={{ color: 'var(--color-warning)' }}>-{item.fee_amount.toFixed(4)} {rule?.source_token}</span>
                      ) : '-'}
                    </td>
                    <td>
                      {item.status === 'success' ? (
                        <span className="badge badge-success">成功</span>
                      ) : (
                        <span className="badge badge-error">失敗</span>
                      )}
                    </td>
                    <td style={{ fontSize: '10px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.status === 'success' && item.tx_digest ? (
                        <span style={{ color: 'var(--color-sui)', cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(item.tx_digest as string)}>
                          {item.tx_digest}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-error)' }} title={item.error_message}>
                          {item.error_message}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
