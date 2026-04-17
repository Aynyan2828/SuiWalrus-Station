// ==========================================
// 署名プロバイダ（鍵管理層）
// 既存 Sui CLI の keystore を読み取り、ローカルで署名する。
// 秘密鍵をログ・画面・設定ファイルに出力しない。
// ==========================================
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey, encodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { fromBase64 } from '@mysten/sui/utils';
import { invoke } from '@tauri-apps/api/core';

/**
 * 秘密鍵文字列（Bech32 または Base64）から secretKey を抽出する内部ヘルパー
 */
function getSecretKey(encodedKey: string): Uint8Array | null {
  try {
    if (encodedKey.startsWith('suiprivkey')) {
      const decoded = decodeSuiPrivateKey(encodedKey);
      return decoded.secretKey;
    } else {
      // レガシーな Base64 フォーマット
      const bytes = fromBase64(encodedKey);
      // bytes[0] はフラグ (0: Ed25519)
      if (bytes[0] === 0) {
        return bytes.slice(1);
      }
    }
  } catch (e) {
    console.warn('鍵のデコードに失敗:', e);
  }
  return null;
}

/**
 * keystore ファイルから指定アドレスに対応するキーペアを一時取得する。
 */
export async function getKeypairForAddress(
  address: string,
  keystorePath?: string
): Promise<Ed25519Keypair> {
  const ksPath = keystorePath || await resolveKeystorePath();
  const raw = await invoke<string>('read_text_file', { path: ksPath });
  const keys: string[] = JSON.parse(raw);

  for (const encodedKey of keys) {
    const secretKey = getSecretKey(encodedKey);
    if (!secretKey || secretKey.length !== 32) continue;

    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const derivedAddr = keypair.getPublicKey().toSuiAddress();

    if (derivedAddr === address) {
      return keypair;
    }
  }

  throw new Error(
    `アドレス ${address.slice(0, 10)}... に対応する Ed25519 鍵が keystore に見つかりませんでした。`
  );
}

/**
 * 指定したアドレスに対応する秘密鍵文字列を最新形式 (suiprivkey...) で取得する
 */
export async function getPrivateKeyForAddress(
  address: string,
  keystorePath?: string
): Promise<string> {
  const ksPath = keystorePath || await resolveKeystorePath();
  const raw = await invoke<string>('read_text_file', { path: ksPath });
  const keys: string[] = JSON.parse(raw);

  for (const encodedKey of keys) {
    const secretKey = getSecretKey(encodedKey);
    if (!secretKey || secretKey.length !== 32) continue;

    const keypair = Ed25519Keypair.fromSecretKey(secretKey);
    const derivedAddr = keypair.getPublicKey().toSuiAddress();

    if (derivedAddr === address) {
      // 元が Base64 であっても、最新の suiprivkey 形式にエンコードして返すのが最も親切
      return encodeSuiPrivateKey(secretKey, 'ED25519');
    }
  }

  throw new Error(`指定されたアドレス ${address.slice(0,8)}... の秘密鍵が見つかりませんでした。`);
}

/**
 * keystore ファイルのデフォルトパスを解決する
 */
async function resolveKeystorePath(): Promise<string> {
  try {
    const { detectConfigPaths } = await import('../settings-service');
    const paths = await detectConfigPaths();
    if (paths.sui_keystore) return paths.sui_keystore;
    if (paths.sui_config_dir) return `${paths.sui_config_dir}\\sui.keystore`;
  } catch { /* fallthrough */ }
  return 'C:\\Users\\Public\\.sui\\sui_config\\sui.keystore';
}
