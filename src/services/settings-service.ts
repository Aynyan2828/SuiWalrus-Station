// ==========================================
// 設定サービス
// Tauri invoke でRustバックエンドの設定管理を呼び出す
// ==========================================
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings, CommandHistoryEntry, WalletMetadata, DetectedPaths, PortfolioSnapshot } from '../types';

/** 設定を取得 */
export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>('get_settings');
}

/** 設定を保存 */
export async function saveSettings(settings: AppSettings): Promise<void> {
  return invoke<void>('save_settings', { settings });
}

/** Sui/Walrus の設定ディレクトリ・keystore を自動検出（Rust: detect_config_paths） */
export async function detectConfigPaths(): Promise<DetectedPaths> {
  return invoke<DetectedPaths>('detect_config_paths');
}

/** 旧名エイリアス（互換用） */
export const getDetectedPaths = detectConfigPaths;

/** 実行履歴を読み込み */
export async function loadCommandHistory(): Promise<CommandHistoryEntry[]> {
  return invoke<CommandHistoryEntry[]>('load_command_history');
}

/** 実行履歴を保存 */
export async function saveCommandHistory(history: CommandHistoryEntry[]): Promise<void> {
  return invoke<void>('save_command_history', { history });
}

/** ウォレットメタデータを読み込み */
export async function loadWalletMetadata(): Promise<WalletMetadata[]> {
  return invoke<WalletMetadata[]>('load_wallet_metadata');
}

/** ウォレットメタデータを保存 */
export async function saveWalletMetadata(metadata: WalletMetadata[]): Promise<void> {
  return invoke<void>('save_wallet_metadata', { metadata });
}

/** ポートフォリオ履歴を読み込み */
export async function loadPortfolioHistory(): Promise<PortfolioSnapshot[]> {
  return invoke<PortfolioSnapshot[]>('load_portfolio_history');
}

/** ポートフォリオ履歴を保存 */
export async function savePortfolioHistory(history: PortfolioSnapshot[]): Promise<void> {
  return invoke<void>('save_portfolio_history', { history });
}
