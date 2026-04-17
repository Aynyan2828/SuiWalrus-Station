// ==========================================
// SuiNS & Walrus Site サービス
// Suiネットワーク上のドメイン名とBlob IDの紐付けを取得するばい
// ==========================================
import { executeCommand } from './cli-runner';

export interface DomainMapping {
  domain: string;      // 例: "mysite.walrus"
  blobId: string;      // 紐付いとる Walrus Blob ID
  objectId: string;    // Sui上のオブジェクトID
  type: 'suins' | 'site'; // SuiNSドメインか、直接のSiteオブジェクトか
}

/**
 * アドレスが所有する SuiNS ドメインと Walrus Site を取得する
 */
export async function getDomainMappings(
  address: string,
  suiCliPath?: string
): Promise<DomainMapping[]> {
  const result = await executeCommand(
    'sui',
    ['client', 'objects', address, '--json'],
    suiCliPath
  );

  if (!result.success) {
    console.error('SuiNSドメイン取得失敗:', result.stderr);
    return [];
  }

  try {
    const objects = JSON.parse(result.stdout);
    const mappings: DomainMapping[] = [];

    for (const obj of objects) {
      const typeStr = obj.data?.type || '';
      const fields = obj.data?.content?.fields;
      
      // 1. SuiNS ドメインの探索
      if (typeStr.includes('suins::SuiNS') || typeStr.includes('suins::Name')) {
        const domain = fields?.name || '';
        // ユーザーが指摘したメタデータ (user_data) から walrusSiteId を優先的に探す
        const userData = fields?.user_data?.fields?.contents || [];
        let siteId = '';
        
        // 簡易ペア探索
        for (const pair of userData) {
          if (pair.fields?.key === 'walrusSiteId') {
            siteId = pair.fields?.value;
            break;
          }
        }

        // フォールバック: 以前の直接的な blob_id フィールド
        const blobId = fields?.walrus_blob_id || fields?.walrus || '';
        
        if (domain && (siteId || blobId)) {
          mappings.push({
            domain,
            blobId: siteId ? '' : decimalToWalrusBase64(String(blobId)),
            objectId: siteId || obj.data.objectId,
            type: 'suins'
          });
        }
      }

      // 2. Walrus Site オブジェクトの探索
      if (typeStr.includes('::site::Site')) {
        const siteName = fields?.metadata?.fields?.site_name || fields?.name || 'Unnamed Site';
        mappings.push({
          domain: siteName,
          blobId: '', // blob_id は Dynamic Fields 経由で後で解決する
          objectId: obj.data.objectId,
          type: 'site'
        });
      }
    }

    return mappings;
  } catch (e) {
    console.error('SuiNSデータパースエラー:', e);
    return [];
  }
}

/**
 * 10進数の Blob ID (Suiオブジェクト内) を Walrus 標準の Base64 URL 形式に変換するばい
 */
export function decimalToWalrusBase64(decimalStr: string): string {
  try {
    const n = BigInt(decimalStr);
    const hex = n.toString(16).padStart(64, '0');
    
    // 16進数から Uint8Array (32 bytes) に変換
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    
    // Base64 URL 形式に変換 (Paddingなし)
    const base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch (e) {
    console.error('ID変換エラー:', e);
    return decimalStr;
  }
}

/**
 * Site オブジェクト ID から最新の Blob ID を取得するばい (Dynamic Fields対応版)
 */
export async function getLatestBlobIdFromSite(
  siteObjectId: string,
  suiCliPath?: string
): Promise<string | null> {
  // 1. 通常のオブジェクト情報取得を試みる
  const result = await executeCommand(
    'sui',
    ['client', 'object', siteObjectId, '--json'],
    suiCliPath
  );

  if (result.success) {
    try {
      const obj = JSON.parse(result.stdout);
      const fields = obj.data?.content?.fields;
      
      const decimalId = fields?.latest_blob_id || 
                        fields?.blob_id ||
                        fields?.active_blob_id ||
                        fields?.current_blob_id;

      if (decimalId) {
        console.info(`[suins-service] Siteオブジェクトから ID: ${siteObjectId} -> Blob: ${decimalId} ば特定したばい`);
        return decimalToWalrusBase64(String(decimalId));
      }
    } catch (e) {
      console.warn('Siteオブジェクトのパースに失敗:', e);
    }
  }

  // 2. フィールドが直接取れない場合は Dynamic Fields をスキャン (fallback)
  const dfResult = await executeCommand(
    'sui',
    ['client', 'dynamic-field', siteObjectId, '--json'],
    suiCliPath
  );

  if (dfResult.success) {
    try {
      const dfs = JSON.parse(dfResult.stdout);
      // A. ルーティング優先順位: / -> /index.html
      const rootRes = dfs.find((df: any) => {
        const path = df.json?.name?.path || df.name?.value || df.json?.name;
        return path === '/' || path === '/index.html';
      });

      if (rootRes) {
        const decimalId = rootRes.json?.value?.blob_id || 
                          rootRes.value?.blob_id ||
                          rootRes.json?.blob_id ||
                          rootRes.json?.value;
        if (decimalId) return decimalToWalrusBase64(String(decimalId));
      }

      // B. フォールバック [しぶとく特定]: 
      for (const df of dfs) {
        const decimalId = df.json?.value?.blob_id || 
                          df.value?.blob_id ||
                          df.json?.blob_id ||
                          df.json?.value;
        if (decimalId && typeof decimalId !== 'object') {
          console.info(`[DynamicField Scan] ID: ${siteObjectId} の中で最初に見つかった Blob ID を利用したばい`);
          return decimalToWalrusBase64(String(decimalId));
        }
      }
    } catch (e) {
      console.warn('Dynamic Fieldsのパースに失敗:', e);
    }
  }

  return null;
}

/**
 * Blob ID から Portal / Aggregator URL を生成するばい
 */
export function getPortalUrl(blobId: string, isMainnet: boolean = true): string {
  // 標準的な walrus.site ポータル
  return `https://${blobId}.walrus.site`;
}

export function getAggregatorUrl(blobId: string, isMainnet: boolean = true): string {
  const env = isMainnet ? 'mainnet' : 'testnet';
  return `https://aggregator-${env}.walrus.space/read/${blobId}`;
}
