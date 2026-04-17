// ==========================================
// エクスプローラー連携ユーティリティ
// Suiscan / SuiVision へのリンク生成
// ==========================================

type ExplorerNetwork = 'mainnet' | 'testnet' | 'devnet';

/**
 * activeEnv 文字列からエクスプローラー用ネットワーク名を解決する
 */
export function resolveExplorerNetwork(activeEnv: string): ExplorerNetwork {
  const lower = activeEnv.toLowerCase();
  if (lower.includes('testnet')) return 'testnet';
  if (lower.includes('devnet')) return 'devnet';
  return 'mainnet';
}

/**
 * Suiscan のベースURL
 */
function suiscanBase(network: ExplorerNetwork): string {
  if (network === 'mainnet') return 'https://suiscan.xyz/mainnet';
  return `https://suiscan.xyz/${network}`;
}

/**
 * トランザクションの Suiscan URL
 */
export function getTxExplorerUrl(digest: string, activeEnv: string): string {
  const net = resolveExplorerNetwork(activeEnv);
  return `${suiscanBase(net)}/tx/${digest}`;
}

/**
 * オブジェクトの Suiscan URL
 */
export function getObjectExplorerUrl(objectId: string, activeEnv: string): string {
  const net = resolveExplorerNetwork(activeEnv);
  return `${suiscanBase(net)}/object/${objectId}`;
}

/**
 * アドレスの Suiscan URL
 */
export function getAddressExplorerUrl(address: string, activeEnv: string): string {
  const net = resolveExplorerNetwork(activeEnv);
  return `${suiscanBase(net)}/account/${address}`;
}

/**
 * Walrus Aggregator URL（Blobコンテンツ取得用）
 */
export function getWalrusAggregatorUrl(blobId: string, isMainnet: boolean = true): string {
  const base = isMainnet
    ? 'https://aggregator.walrus.site'
    : 'https://aggregator.testnet.walrus.site';
  return `${base}/v1/blobs/${blobId}`;
}
