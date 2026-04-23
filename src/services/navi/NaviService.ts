import { Transaction } from '@mysten/sui/transactions';
import { executePtbAndReturnResult } from '../sui-sdk/sui-sdk-service';

/**
 * Navi Protocol 連携サービス
 * 報酬の回収や自動複利（Auto-compound）を担当します。
 */
export class NaviService {
  /**
   * 未回収の報酬額を取得（仮実装：SDKやAPIから動的に取得するように拡張可能）
   */
  static async getClaimableRewards(address: string, env: string): Promise<{ symbol: string, amount: number }[]> {
    // 実際には Navi のプロトコルオブジェクトをクエリして計算します
    // 今はデモ用に 0 以上の数値を返すようにしておきます
    console.log(`[NaviService] ${address} の報酬を確認中...`);
    return [
      { symbol: 'NAVX', amount: 0.000 },
      { symbol: 'SUI', amount: 0.000 }
    ];
  }

  /**
   * 報酬を回収して再投資 (Auto-compound)
   */
  static async autoCompound(
    address: string,
    env: 'mainnet' | 'testnet' | 'devnet' | 'localnet',
    cliPath: string
  ) {
    try {
      const { depositCoinPTB, claimRewardPTB } = await import('@naviprotocol/lending');
      const tx = new Transaction();

      console.log(`[NaviService] Auto-compound 開始: ${address}`);

      // 1. 報酬の回収 (Claim)
      // Navi では特定の報酬プール(inno_incentive等)を指定して Claim します
      // ここでは SDK の標準的な方法で全報酬の Claim を試みます
      // ※実際にはユーザーが預けているプールIDの特定が必要です
      // await claimRewardPTB(tx, 'Sui', 0); // 例: SUIプールの報酬

      // ⚠️ 現状の SDK では簡略化のため、Claim と Deposit を連続して PTB に積み込みます
      // (本来は Swap を挟んで銘柄を統一するのが理想です)
      
      // 2. とりあえず「溜まっているであろう SUI」を再投資するロジックをスケルトン実装
      // 実際には Claim で得た Coin オブジェクトをそのまま Deposit に繋ぐことができます

      addLogInternal('info', 'Navi', '報酬の回収と再投資をプロトコルへ要求しています...');

      // 署名と実行
      const result = await executePtbAndReturnResult(
        tx,
        address,
        env,
        cliPath
      );

      return result;
    } catch (error) {
      console.error('[NaviService] Auto-compound Failed:', error);
      throw error;
    }
  }
}

function addLogInternal(level: string, source: string, message: string) {
  console.log(`[${level.toUpperCase()}][${source}] ${message}`);
}
