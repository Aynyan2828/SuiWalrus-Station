// ==========================================
// AI Agent 関連の型定義
// ==========================================

export type StrategyType = 
  | 'daily_dca_swap'
  | 'weekly_dca_swap'
  | 'buy_and_hold_accumulate'
  | 'excess_balance_rebalance'
  | 'deposit_to_navi'
  | 'condition_threshold'; // Phase 8: 価格条件トリガー
export type Frequency = 'daily' | 'weekly' | 'condition';
export type ApprovalMode = 'manual_only' | 'first_5_manual' | 'auto';
export type TaskStatus = 'pending_approval' | 'executed' | 'skipped' | 'failed';

export interface FeeConfig {
  enabled: boolean;
  mode: 'percentage_from_principal';
  rate_bps: number; // 300 = 3%
  apply_on_networks: string[]; // ['mainnet']
  collector_address: string;
}

export interface AgentRule {
  id: string;
  name: string;
  enabled: boolean;
  strategy_type: StrategyType;
  source_token: string;
  target_token: string;
  amount: number; // 基準となる額（USDC等）
  frequency: Frequency;
  execution_time?: string; // '00:00' 形式 (daily の場合)
  condition_target?: string; // 価格監視対象 (例: 'SUI')
  condition_operator?: '<' | '>'; // 条件 (以下、以上など)
  threshold_amount?: number; // 監視価格や余剰判定の数値 (例: 1.5ドル)
  approval_mode: ApprovalMode;
  max_slippage_bps: number; // 1% = 100
  daily_limit_amount: number;
  network: string; // 'mainnet'
  allowed_protocols: string[]; // ['cetus', 'navi']
  execution_count: number;
  total_spent: number; // 累計使用額
  total_fees_collected?: number; // 累計徴収手数料
  fee_config?: FeeConfig;
  created_at: string;
  last_executed_at?: string;
  last_execution_status?: 'success' | 'failed';
}

export interface AgentTask {
  id: string;
  rule_id: string;
  status: TaskStatus;
  scheduled_for: string; // ISO 8601 string
  expected_source_amount: number;
  fee_amount?: number;        // 手数料
  net_execution_amount?: number; // 実行実額
  expected_receive_amount?: number; // 見積もり
  estimated_gas?: number;
  expected_slippage_bps?: number;
  expires_at: string; // 承認期限
}

export interface AgentHistory {
  id: string;
  timestamp: string;
  rule_id: string;
  task_id: string;
  action_description: string;
  status: 'success' | 'failed';
  tx_digest?: string;
  error_message?: string;
  spent_amount: number;     // 元本
  fee_amount?: number;      // 徴収手数料
  net_amount?: number;      // 実行実額
  received_amount: number;
}

export interface SupportedToken {
  symbol: string;
  display_name: string;
  decimals: number;
  coin_type?: string;     // オンチェーンの type (例: 0x2::sui::SUI)
  category: 'stable' | 'native' | 'utility' | 'meme';
  enabled: boolean;
  can_swap_source: boolean;
  can_swap_target: boolean;
  icon_url?: string;
}
