// ==========================================
// SuiWalrus Station - 型定義
// ==========================================

/** CLI実行結果 */
export interface CliResult {
  stdout: string;
  stderr: string;
  raw_stdout?: string;
  raw_stderr?: string;
  exit_code: number;
  duration_ms: number;
  cli_path: string;
  command: string;
  success: boolean;
}

/** CLI接続ステータス */
export interface ConnectionStatus {
  sui_available: boolean;
  sui_version: string;
  sui_path: string;
  walrus_available: boolean;
  walrus_version: string;
  walrus_path: string;
  site_builder_available: boolean;
  site_builder_version: string;
  site_builder_path: string;
}

/** アプリ設定 */
export interface AppSettings {
  sui_cli_path: string;
  walrus_cli_path: string;
  site_builder_cli_path: string;
  site_builder_config_path: string;
  ai_provider: string;
  ai_api_key: string;
  ai_base_url: string;
  ai_model: string;
  ai_mode: AiMode;
  log_level: string;
  // Tradeport 連携設定
  tradeport_enabled: boolean;
  tradeport_api_key: string;
  tradeport_api_user: string;
  tradeport_agent_enabled: boolean;
}

/** AIモード */
export type AiMode = 'guard' | 'explain' | 'off';

/** AI判定結果 */
export interface AiGuardResult {
  risk_level: RiskLevel;
  summary: string;
  explanation: string;
  warnings: string[];
  recommendation: string;
}

/** 危険度レベル */
export type RiskLevel = 'low' | 'medium' | 'high';

/** ウォレット情報（CLI出力をパースしたもの） */
export interface WalletInfo {
  address: string;
  alias: string;
  is_active: boolean;
  balance?: string;
  balance_mist?: number;
}

/** ウォレットメタデータ（GUI側で管理） */
export interface WalletMetadata {
  address: string;
  alias: string;
  label: string;
  tags: string[];
  is_favorite: boolean;
}

/** コマンド履歴エントリ */
export interface CommandHistoryEntry {
  id: string;
  command: string;
  cli_type: 'sui' | 'walrus' | 'site-builder';
  category: string;
  wallet_address: string;
  network: string;
  status: 'success' | 'error' | 'cancelled';
  stdout: string;
  stderr: string;
  raw_stdout?: string;
  raw_stderr?: string;
  exit_code: number;
  duration_ms: number;
  executed_at: string;
  ai_risk_level?: RiskLevel;
  ai_explanation?: string;
}

/** ネットワーク環境 */
export interface NetworkEnv {
  alias: string;
  rpc: string;
  ws?: string;
}

/** 検出された設定パス */
export interface DetectedPaths {
  sui_config_dir: string | null;
  walrus_config_dir: string | null;
  sui_keystore: string | null;
  walrus_config_file: string | null;
}

/** ログエントリ */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  cli_path?: string;
  config_path?: string;
}

/** コマンドテンプレート */
export interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  cli_type: 'sui' | 'walrus' | 'site-builder';
  category: string;
  command: string;
  args: TemplateArg[];
  risk_level: RiskLevel;
  is_read_only: boolean;
}

/** テンプレート引数 */
export interface TemplateArg {
  name: string;
  description: string;
  required: boolean;
  default_value?: string;
  type: 'string' | 'number' | 'address' | 'select';
  options?: string[];
  advanced?: boolean; // 初心者モードで非表示
  is_path?: boolean;
  path_type?: 'file' | 'directory';
  path_filters?: string[];
  arg_style?: 'flag' | 'positional'; // 'flag' (default) or 'positional'
  flag_name?: string; // Example: '--epochs'
}

/** ページ定義 */
export type Page = 'dashboard' | 'wallet' | 'sui' | 'tradeport' | 'sui-sdk' | 'ai-agent' | 'walrus' | 'history' | 'settings';

/** Walrus blob情報 */
export interface WalrusBlobInfo {
  blob_id: string;
  status: string;
  size?: number;
  epoch?: number;
  certified_epoch?: number;
  site_title?: string; // サイト名
  site_url?: string;   // サイトへのURL
  suins_name?: string; // SuiNS名
  is_local_site?: boolean; // ローカル履歴から発見されたか
  is_offline?: boolean;    // Epoch期限切れなどでWalrus上に存在しない
  site_object_id?: string; // Sui上のSiteオブジェクトID
}

/**
 * トークン残高情報
 */
export interface TokenBalance {
  symbol: string;
  name: string;
  coinType: string;
  balance: bigint;
  decimals: number;
  formatted: string;
}

/**
 * トースト通知情報
 */
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  duration?: number;
}
