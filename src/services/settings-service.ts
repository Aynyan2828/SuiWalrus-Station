// ==========================================
// 設定サービス
// Tauri invoke でRustバックエンドの設定管理を呼び出す
// ==========================================
import { invoke } from '@tauri-apps/api/core';
import type { AppSettings, CommandHistoryEntry, WalletMetadata, DetectedPaths, PortfolioSnapshot } from '../types';

/** 設定を取得 */
// ... (中略)

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
