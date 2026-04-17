// ==========================================
// Walrusサービス
// 既存Walrus CLIのコマンドをラップ
// 設定を壊さず、読み取り中心の操作
// ==========================================
import { executeCommand } from './cli-runner';
import type { WalrusBlobInfo } from '../types';

/**
 * 登録済みblob一覧を取得する
 * `walrus list-blobs --json` の結果をパース
 */
export async function listBlobs(walrusCliPath?: string): Promise<WalrusBlobInfo[]> {
  const result = await executeCommand('walrus', ['list-blobs', '--json'], undefined, walrusCliPath);
  if (!result.success) {
    // list-blobsが使えない場合は空配列を返す
    console.warn('Walrus list-blobs 失敗:', result.stderr);
    return [];
  }

  try {
    const data = JSON.parse(result.stdout);
    if (Array.isArray(data)) {
      return data.map((blob: Record<string, unknown>) => ({
        blob_id: String(blob.blob_id || blob.blobId || ''),
        status: String(blob.status || 'unknown'),
        size: Number(blob.size || 0),
        epoch: blob.epoch ? Number(blob.epoch) : undefined,
        certified_epoch: blob.certified_epoch ? Number(blob.certified_epoch) : undefined,
      }));
    }
    // オブジェクト形式で返ってくる場合
    if (data && typeof data === 'object') {
      const blobs = data.blobs || data.data || [];
      if (Array.isArray(blobs)) {
        return blobs.map((blob: Record<string, unknown>) => ({
          blob_id: String(blob.blob_id || blob.blobId || ''),
          status: String(blob.status || 'unknown'),
          size: Number(blob.size || 0),
          epoch: blob.epoch ? Number(blob.epoch) : undefined,
          certified_epoch: blob.certified_epoch ? Number(blob.certified_epoch) : undefined,
        }));
      }
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * blobのステータスを確認する
 */
export async function getBlobStatus(
  blobId: string,
  walrusCliPath?: string
): Promise<string> {
  const result = await executeCommand(
    'walrus',
    ['blob-status', blobId, '--json'],
    undefined,
    walrusCliPath,
  );
  if (!result.success) {
    throw new Error(`Blob status 取得失敗: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * Walrusシステム情報を取得する
 */
export async function getWalrusInfo(walrusCliPath?: string): Promise<string> {
  const result = await executeCommand('walrus', ['info', '--json'], undefined, walrusCliPath);
  if (!result.success) {
    throw new Error(`Walrus info 取得失敗: ${result.stderr}`);
  }
  return result.stdout;
}

/**
 * Walrusヘルス確認
 */
export async function getWalrusHealth(walrusCliPath?: string): Promise<string> {
  const result = await executeCommand('walrus', ['health'], undefined, walrusCliPath);
  return result.success ? result.stdout : result.stderr;
}

// ==========================================
// Blob プレビュー / ダウンロード
// ==========================================

export interface BlobPreviewResult {
  contentType: string;
  isText: boolean;
  isImage: boolean;
  textContent?: string;
  dataUrl?: string;
  size: number;
  blobId: string;
}

/**
 * Walrus Aggregator 経由で Blob 内容を取得してプレビュー用データを返すばい
 */
export async function readBlobViaAggregator(
  blobId: string,
  isMainnet: boolean = true,
): Promise<BlobPreviewResult> {
  const base = isMainnet
    ? 'https://aggregator.walrus.site'
    : 'https://aggregator.testnet.walrus.site';
  const url = `${base}/v1/blobs/${blobId}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Blob 取得に失敗しました (HTTP ${response.status}): ${response.statusText}`);
  }

  const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
  const isText = contentType.startsWith('text/') ||
    contentType.includes('json') ||
    contentType.includes('xml') ||
    contentType.includes('javascript') ||
    contentType.includes('css') ||
    contentType.includes('html');
  const isImage = contentType.startsWith('image/');

  const blob = await response.blob();
  const size = blob.size;

  let textContent: string | undefined;
  let dataUrl: string | undefined;

  if (isText && size < 500_000) {
    // テキスト系: 文字列として読み取り
    textContent = await blob.text();
  } else if (isImage && size < 10_000_000) {
    // 画像: Data URLに変換
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  return {
    contentType,
    isText,
    isImage,
    textContent,
    dataUrl,
    size,
    blobId,
  };
}

/**
 * Blob をローカルにダウンロードする（ブラウザのダウンロードダイアログ経由）
 */
export function downloadBlob(blobId: string, isMainnet: boolean = true): void {
  const base = isMainnet
    ? 'https://aggregator.walrus.site'
    : 'https://aggregator.testnet.walrus.site';
  const url = `${base}/v1/blobs/${blobId}`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `blob-${blobId.slice(0, 12)}`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

