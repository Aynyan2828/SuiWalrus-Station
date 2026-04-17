// ==========================================
// AI Agent - Fee Engine (手数料計算エンジン)
// ==========================================
import type { AgentRule, FeeConfig } from '../../types/agent-types';

export const DEFAULT_COLLECTOR_ADDRESS = '0x98dc29b76067c6c6b54c98db14c4cac92d6996a062ba83ae50a282ec62e8cbbd';

/**
 * 手数料設定のデフォルト
 */
export const DEFAULT_FEE_CONFIG: FeeConfig = {
  enabled: true,
  mode: 'percentage_from_principal',
  rate_bps: 300, // 3%
  apply_on_networks: ['mainnet'],
  collector_address: DEFAULT_COLLECTOR_ADDRESS,
};

/**
 * 手数料の計算
 */
export function calculateFeeBreakdown(principal: number, config: FeeConfig = DEFAULT_FEE_CONFIG) {
  if (!config.enabled) {
    return {
      feeAmount: 0,
      netAmount: principal,
      rateBps: 0
    };
  }

  // 割合計算 (Basis Points)
  // fee = principal * (rate_bps / 10000)
  const feeAmount = (principal * config.rate_bps) / 10000;
  const netAmount = principal - feeAmount;

  return {
    feeAmount: Number(feeAmount.toFixed(9)), // 小数点以下の精度を保ちつつ丸める
    netAmount: Number(netAmount.toFixed(9)),
    rateBps: config.rate_bps
  };
}

/**
 * 現在の実行環境・条件で手数料を徴収すべきか判定
 */
export function shouldApplyFee(
  rule: AgentRule,
  network: string,
  isManual: boolean = false
): boolean {
  const config = rule.fee_config || DEFAULT_FEE_CONFIG;

  if (!config.enabled) return false;
  
  // 1. ネットワークチェック (mainnetのみ等)
  if (!config.apply_on_networks.includes(network)) return false;

  // 2. 手動実行チェック
  // ユーザーの指示: 「手動実行時は課金しない」
  if (isManual) return false;

  // 3. 元本が極端に小さい場合はエラーを避けるために 0 になるが、基本は true
  return true;
}

/**
 * トークンの最小単位 (String) に変換
 */
export function toRawAmount(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}
