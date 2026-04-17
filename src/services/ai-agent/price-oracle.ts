// ==========================================
// AI Agent - 価格オラクルヘルパー (Pyth Hermes連携)
// ==========================================

// Pyth Network Price Feed IDs (USDペア)
// ※ 16進数の '0x' プレフィックスを付けるか省略するかはHermesの仕様に依存（通常はつけないか、どっちでもOK）
export const PYTH_FEED_IDS: Record<string, string> = {
  'SUI': '0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744',
  'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  // 必要に応じて他のトークンも追加
};

/**
 * Pyth Hermes から指定したトークンシンボルの最新価格 (USD) を取得する
 * @param symbol 토큰シンボル (例: 'SUI')
 * @returns 現在の価格 (数値) または null (取得失敗時)
 */
export async function getLatestPriceUSD(symbol: string): Promise<number | null> {
  try {
    const feedId = PYTH_FEED_IDS[symbol.toUpperCase()];
    if (!feedId) {
      console.warn(`[Pyth Oracle] ${symbol} のPrice Feed IDが登録されていません。`);
      return null;
    }

    // Hermes V2エンドポイントを叩く (parsed=true を指定することでJSON構造で取得可能)
    // ※ '0x' プレフィックスがついていても問題なく動作しますが、もしAPIエラーになった場合は消す処理を入れます
    const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}&parsed=true`);
    
    if (!response.ok) {
      console.error(`[Pyth Oracle] 価格の取得に失敗しました: ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    const parsedData = data.parsed?.[0];

    if (!parsedData || !parsedData.price) {
      console.error(`[Pyth Oracle] 価格データが見つかりません。レスポンス形式が予期したものと異なります。`);
      return null;
    }

    const { price, expo } = parsedData.price;
    // 価格は整数（price）と指数（expo）で返ってくるので実際の数値に変換する
    // 例: price="15000000", expo=-8 -> 0.15 USD
    const actualPrice = Number(price) * (10 ** Number(expo));
    
    return actualPrice;

  } catch (error) {
    console.error(`[Pyth Oracle] 例外エラー:`, error);
    return null;
  }
}
