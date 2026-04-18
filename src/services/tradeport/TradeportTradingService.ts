import { invoke } from '@tauri-apps/api/core';
import { SuiTradingClient } from '@tradeport/sui-trading-sdk';
import { executePtbAndReturnResult } from '../sui-sdk/sui-sdk-service';
import type { AppSettings } from '../../types';

/**
 * Tradeport Trading SDK 連携サービス
 * NFT取引（購入、出品、入札など）のトランザクション構築を行う
 */
export class TradeportTradingService {
  private static client: SuiTradingClient | null = null;
  private static initializedSettings: string = '';

  /**
   * クライアントの初期化
   */
  private static async getClient(settings: AppSettings): Promise<SuiTradingClient> {
    const settingsKey = `${settings.tradeport_api_key}-${settings.tradeport_api_user}`;
    
    if (this.client && this.initializedSettings === settingsKey) {
      return this.client;
    }

    if (!settings.tradeport_api_key || !settings.tradeport_api_user) {
      throw new Error('Tradeport API キーが設定されていません。');
    }

    this.client = new SuiTradingClient({
      apiKey: settings.tradeport_api_key,
      apiUser: settings.tradeport_api_user,
    });
    this.initializedSettings = settingsKey;
    return this.client;
  }

  /**
   * 設定を自動取得してクライアントを準備
   */
  private static async initClient(): Promise<SuiTradingClient> {
    const { getSettings } = await import('../settings-service');
    const settings = await getSettings();
    return this.getClient(settings);
  }

  /**
   * 購入トランザクションの準備と実行
   */
  static async buyNftListing(
    listingId: string,
    buyerAddress: string,
    envName: 'mainnet' | 'testnet' | 'devnet' | 'localnet',
    keystorePath?: string
  ) {
    try {
      const sdk = await this.initClient();

      console.log(`[TradeportTrading] 購入準備中: Listing ${listingId} for ${buyerAddress}`);
      
      // 1. Tradeport SDK を使用して購入用の Transaction を作成
      // 最新の SDK 仕様では buyListings を使用し、配列で listingIds を渡します
      const tx = await sdk.buyListings({
        listingIds: [listingId],
        walletAddress: buyerAddress,
      });

      if (!tx) {
        throw new Error('トランザクションの構築に失敗しました。');
      }

      // 2. 既存の sui-sdk-service を使用して、ローカルで署名・実行
      const result = await executePtbAndReturnResult(
        tx as any,
        buyerAddress,
        envName,
        keystorePath
      );

      return result;
    } catch (error) {
      console.error('[TradeportTrading] Buy Flow Failed:', error);
      throw error;
    }
  }

  /**
   * 将来の拡張用: 出品 (List NFT)
   */
  static async listNft(
    nftId: string,
    priceMist: string,
    sellerAddress: string,
    envName: string
  ) {
    // Phase 2 以降で実装
    throw new Error('Not implemented yet in Phase 1');
  }
}
