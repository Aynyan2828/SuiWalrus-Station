// ==========================================
// Sui SDK クライアント（Driver 層）
// SuiJsonRpcClient のラッパー。RPC 接続管理を担当。
// 既存 CLI 機能には一切干渉しない。
// ==========================================
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';

/** 既知のネットワーク名 */
type KnownNetwork = 'mainnet' | 'testnet' | 'devnet' | 'localnet';

const KNOWN_NETWORKS: KnownNetwork[] = ['mainnet', 'testnet', 'devnet', 'localnet'];

/** クライアントキャッシュ（ネットワークごとに1つ） */
const clientCache = new Map<string, SuiJsonRpcClient>();

/**
 * 環境名から RPC URL を解決する
 */
export function resolveRpcUrl(envName: string): string {
  const lower = envName.toLowerCase().trim();
  for (const net of KNOWN_NETWORKS) {
    if (lower.includes(net)) {
      return getJsonRpcFullnodeUrl(net);
    }
  }
  if (lower.startsWith('http')) return lower;
  return getJsonRpcFullnodeUrl('mainnet');
}

/**
 * 環境名からネットワーク名を解決する
 */
function resolveNetwork(envName: string): KnownNetwork {
  const lower = envName.toLowerCase().trim();
  for (const net of KNOWN_NETWORKS) {
    if (lower.includes(net)) return net;
  }
  return 'mainnet';
}

/**
 * SuiJsonRpcClient を取得する（キャッシュ付き）
 */
export function getClient(envName: string): SuiJsonRpcClient {
  const url = resolveRpcUrl(envName);
  let client = clientCache.get(url);
  if (!client) {
    const network = resolveNetwork(envName);
    client = new SuiJsonRpcClient({ url, network });
    clientCache.set(url, client);
  }
  return client;
}

/**
 * クライアントキャッシュをクリアする
 */
export function clearClientCache(): void {
  clientCache.clear();
}

/**
 * RPC 接続テスト
 */
export async function testRpcConnection(envName: string): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    const client = getClient(envName);
    await client.getLatestCheckpointSequenceNumber();
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: String(e) };
  }
}
