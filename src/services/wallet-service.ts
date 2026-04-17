// ==========================================
// ウォレットサービス
// 既存Sui CLIのウォレット情報を読み取る（書き換えない）
// ==========================================
import { executeCommand } from './cli-runner';
import type { WalletInfo, NetworkEnv } from '../types';

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
 * ウォレット一覧を取得する
 * `sui client addresses --json` の結果をパース
 */
export async function getWallets(suiCliPath?: string): Promise<WalletInfo[]> {
  const result = await executeCommand('sui', ['client', 'addresses', '--json'], suiCliPath);
  if (!result.success) {
    throw new Error(`ウォレット一覧取得失敗: ${result.stderr}`);
  }

  try {
    const data = JSON.parse(result.stdout);
    const activeAddress = data.activeAddress || '';
    const addresses: [string, string][] = data.addresses || [];

    return addresses.map(([alias, address]) => ({
      address,
      alias,
      is_active: address === activeAddress,
    }));
  } catch {
    throw new Error(`ウォレットデータパースエラー: ${result.stdout}`);
  }
}

/**
 * アクティブウォレットのアドレスを取得する
 */
export async function getActiveAddress(suiCliPath?: string): Promise<string> {
  const result = await executeCommand('sui', ['client', 'active-address'], suiCliPath);
  if (!result.success) {
    throw new Error(`アクティブアドレス取得失敗: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * アクティブ環境 (ネットワーク) を取得する
 */
export async function getActiveEnv(suiCliPath?: string): Promise<string> {
  const result = await executeCommand('sui', ['client', 'active-env'], suiCliPath);
  if (!result.success) {
    throw new Error(`アクティブ環境取得失敗: ${result.stderr}`);
  }
  return result.stdout.trim();
}

/**
 * 環境一覧を取得する
 */
export async function getEnvs(suiCliPath?: string): Promise<NetworkEnv[]> {
  const result = await executeCommand('sui', ['client', 'envs', '--json'], suiCliPath);
  if (!result.success) {
    throw new Error(`環境一覧取得失敗: ${result.stderr}`);
  }

  try {
    const data = JSON.parse(result.stdout);
    if (Array.isArray(data)) {
      return data.map((env: { alias: string; rpc: string; ws?: string }) => ({
        alias: env.alias,
        rpc: env.rpc,
        ws: env.ws,
      }));
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * sui client balance --json の実際の出力をパースする
 *
 * 実際の出力構造:
 * [
 *   [                               // <- data[0]: 全コインの配列
 *     [                             // <- 1コインぶん
 *       { coinType, metadata:{symbol,decimals,...}, ... },   // メタデータ
 *       [ { balance:"12345", ... }, ... ]                     // コインオブジェクト群
 *     ],
 *     [ ... ],  // 別のコイン
 *   ],
 *   false                           // <- data[1]: pagination flag
 * ]
 */
function parseBalanceJson(raw: string): TokenBalance[] {
  const data = JSON.parse(raw);
  const tokens: TokenBalance[] = [];

  // data は [配列, boolean] 構造
  let coinEntries: unknown[];
  if (Array.isArray(data) && data.length >= 1 && Array.isArray(data[0])) {
    coinEntries = data[0];
  } else if (Array.isArray(data)) {
    // フォールバック：フラットな配列かもしれない
    coinEntries = data;
  } else {
    return tokens;
  }

  for (const entry of coinEntries) {
    try {
      if (!Array.isArray(entry) || entry.length < 2) continue;

      const meta = entry[0];
      const coinObjects = entry[1];

      if (!meta || typeof meta !== 'object') continue;

      // メタデータから情報取得
      const coinType: string = (meta as Record<string, unknown>).coinType as string || '';
      const metadata = (meta as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
      const symbol: string = (metadata?.symbol as string) || extractSymbol(coinType);
      const name: string = (metadata?.name as string) || symbol;
      const decimals: number = (metadata?.decimals as number) || 9;

      // コインオブジェクト群のbalanceを合算
      let totalBalance = BigInt(0);
      if (Array.isArray(coinObjects)) {
        for (const coin of coinObjects) {
          if (coin && typeof coin === 'object' && 'balance' in coin) {
            totalBalance += BigInt((coin as Record<string, unknown>).balance as string || '0');
          }
        }
      }

      const divisor = BigInt(10) ** BigInt(decimals);
      const whole = totalBalance / divisor;
      const frac = totalBalance % divisor;
      // 小数部を4桁に整形
      const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4);
      const formatted = `${whole}.${fracStr} ${symbol}`;

      tokens.push({
        symbol,
        name,
        coinType,
        balance: totalBalance,
        decimals,
        formatted,
      });
    } catch {
      // パース失敗したコインはスキップ
      continue;
    }
  }

  return tokens;
}

/**
 * coinType 文字列からシンボルを抽出する
 * 例: "0x2::sui::SUI" -> "SUI"
 */
function extractSymbol(coinType: string): string {
  const parts = coinType.split('::');
  return parts.length > 0 ? parts[parts.length - 1] : 'UNKNOWN';
}

/**
 * SUI残高を取得する（ヘッダー表示用、SUIのみ）
 */
export async function getBalance(
  address?: string,
  suiCliPath?: string,
): Promise<string> {
  const allTokens = await getAllBalances(address, suiCliPath);
  const sui = allTokens.find(t => t.symbol === 'SUI');
  return sui ? sui.formatted : '0.0000 SUI';
}

/**
 * 全トークン残高を取得する
 */
export async function getAllBalances(
  address?: string,
  suiCliPath?: string,
): Promise<TokenBalance[]> {
  const args = ['client', 'balance'];
  if (address) args.push(address);
  args.push('--json');

  const result = await executeCommand('sui', args, suiCliPath);
  if (!result.success) {
    throw new Error(`残高取得失敗: ${result.stderr}`);
  }

  try {
    return parseBalanceJson(result.stdout);
  } catch {
    // JSONパース失敗時は空配列
    return [];
  }
}

/**
 * 全トークン残高をフォーマット済み文字列で返す（ダッシュボード表示用）
 */
export async function getFormattedBalances(
  address?: string,
  suiCliPath?: string,
): Promise<string> {
  const tokens = await getAllBalances(address, suiCliPath);
  if (tokens.length === 0) return '0.0000 SUI';
  return tokens.map(t => t.formatted).join(' | ');
}

/**
 * ガスコイン一覧を取得する
 */
export async function getGasCoins(suiCliPath?: string): Promise<string> {
  const result = await executeCommand('sui', ['client', 'gas', '--json'], suiCliPath);
  if (!result.success) {
    throw new Error(`ガスコイン取得失敗: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * アクティブウォレットを切り替える
 */
export async function switchActiveAddress(
  addressOrAlias: string,
  suiCliPath?: string,
): Promise<void> {
  const result = await executeCommand(
    'sui',
    ['client', 'switch', '--address', addressOrAlias],
    suiCliPath,
  );
  if (!result.success) {
    throw new Error(`ウォレット切替失敗: ${result.stderr}`);
  }
}

/**
 * ネットワーク環境を切り替える
 */
export async function switchEnv(
  envAlias: string,
  suiCliPath?: string,
): Promise<void> {
  const result = await executeCommand(
    'sui',
    ['client', 'switch', '--env', envAlias],
    suiCliPath,
  );
  if (!result.success) {
    throw new Error(`環境切替失敗: ${result.stderr}`);
  }
}
/**
 * 新しいアドレスを生成する (Ed25519)
 */
export async function createNewAddress(suiCliPath?: string): Promise<{ address: string; mnemonic: string }> {
  const result = await executeCommand('sui', ['client', 'new-address', 'ed25519', '--json'], suiCliPath);
  if (!result.success) {
    throw new Error(`アドレス生成失敗: ${result.stderr}`);
  }

  try {
    // 成功時: { "alias": "...", "address": "...", "keyScheme": "...", "recoveryPhrase": "..." }
    const data = JSON.parse(result.stdout);
    return {
      address: data.address,
      mnemonic: data.recoveryPhrase
    };
  } catch {
    throw new Error(`データパースエラー: ${result.stdout}`);
  }
}

/**
 * 秘密鍵をインポートする
 */
export async function importPrivateKey(key: string, suiCliPath?: string): Promise<string> {
  const result = await executeCommand('sui', ['client', 'import', key, '--json'], suiCliPath);
  if (!result.success) {
    throw new Error(`インポート失敗: ${result.stderr}`);
  }

  try {
    // 成功時: [ "alias", "address" ]
    const data = JSON.parse(result.stdout);
    if (Array.isArray(data)) return data[1];
    if (data.address) return data.address;
    return result.stdout;
  } catch {
    throw new Error(`データパースエラー: ${result.stdout}`);
  }
}
