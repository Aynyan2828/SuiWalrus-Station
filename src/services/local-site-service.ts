// ==========================================
// ローカルデプロイ履歴サービス
// ws-resources.json などのローカルファイルからサイト情報を取得するばい
// ==========================================
import { invoke } from '@tauri-apps/api/core';

export interface LocalSiteInfo {
  site_name: string;
  object_id: string;
  local_path: string;
  blob_id?: string; // オンチェーンから取得した最新のID
}

/**
 * 指定されたディレクトリまたはファイルからデプロイ情報を読み込む
 */
export async function getLocalSiteInfo(path: string): Promise<LocalSiteInfo | null> {
  try {
    const targetFile = path.endsWith('.json') ? path : `${path}/ws-resources.json`;
    const content = await invoke<string>('read_text_file', { path: targetFile });
    const data = JSON.parse(content);
    
    // 最新の ws-resources.json は object_id と metadata.site_name を持つ
    const objectId = data.object_id;
    const siteName = data.metadata?.site_name || data.site_name;

    if (objectId && siteName) {
      return {
        site_name: siteName,
        object_id: objectId,
        local_path: targetFile
      };
    }
    return null;
  } catch (e) {
    console.warn(`ローカルサイト情報の読み込みに失敗しました (${path}):`, e);
    return null;
  }
}

/**
 * site-config.yaml を読み取って、登録されているサイトのディレクトリから情報を取得する
 */
export async function scanConfigSites(configPath: string): Promise<{sites: LocalSiteInfo[], logs: string[]}> {
  const logs: string[] = [];
  if (!configPath) {
    logs.push("⚠️ 設定ファイルパスが指定されとらんバイ。設定タブば確認してね。");
    return { sites: [], logs };
  }

  logs.push(`🔍 設定ファイル読み込み開始: ${configPath}`);

  try {
    const yamlContent = await invoke<string>('read_text_file', { path: configPath });
    
    // 行ごとに処理して sites: セクションを探す
    const lines = yamlContent.split(/\r?\n/);
    let inSitesSection = false;
    const sites: LocalSiteInfo[] = [];
    let currentSite: { name?: string, source?: string } = {};

    const normalizedConfigPath = configPath.replace(/\\/g, '/');
    const configDir = normalizedConfigPath.substring(0, normalizedConfigPath.lastIndexOf('/') + 1);

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'sites:') {
        inSitesSection = true;
        continue;
      }
      
      // 他のトップレベルセクションが来たら抜ける（簡易判定）
      if (inSitesSection && trimmed.length > 0 && !line.startsWith(' ') && !line.startsWith('-')) {
        // もし最後のブロックがあれば処理
        if (currentSite.name && currentSite.source) await processBlock(currentSite, sites, configDir, logs);
        inSitesSection = false;
        continue;
      }

      if (inSitesSection) {
        // 新しい項目の開始 (- name: か - source:)
        if (trimmed.startsWith('-')) {
          if (currentSite.name && currentSite.source) await processBlock(currentSite, sites, configDir, logs);
          currentSite = {};
          const content = trimmed.substring(1).trim();
          parseLine(content, currentSite);
        } else {
          parseLine(trimmed, currentSite);
        }
      }
    }
    // 最後のブロックを処理
    if (currentSite.name && currentSite.source) await processBlock(currentSite, sites, configDir, logs);

    return { sites, logs };
  } catch (e) {
    logs.push(`❌ YAML読み込みエラー: ${e}`);
    return { sites: [], logs };
  }
}

function parseLine(line: string, site: { name?: string, source?: string }) {
  const nameMatch = line.match(/^name:\s*["']?([^"'\r\n]+)["']?/);
  if (nameMatch) site.name = nameMatch[1].trim();
  const sourceMatch = line.match(/^source:\s*["']?([^"'\r\n]+)["']?/);
  if (sourceMatch) site.source = sourceMatch[1].trim();
}

async function processBlock(site: { name?: string, source?: string }, sites: LocalSiteInfo[], configDir: string, logs: string[]) {
  if (!site.name || !site.source) return;

  let sourcePath = site.source.replace(/\\/g, '/');
  let absolutePath = '';
  
  if (sourcePath.match(/^[a-zA-Z]:\//) || sourcePath.startsWith('/')) {
    absolutePath = sourcePath;
  } else {
    const cleanSource = sourcePath.startsWith('./') ? sourcePath.substring(2) : sourcePath;
    absolutePath = configDir + cleanSource;
  }

  const finalPath = absoluteSourcePathToWindows(absolutePath);
  logs.push(`📁 フォルダ探索中: ${site.name} -> ${finalPath}`);
  
  const info = await getLocalSiteInfo(finalPath);
  if (info) {
    logs.push(`✅ 発見: ${site.name} の ws-resources.json ば読み込んだばい！`);
    sites.push(info);
  } else {
    logs.push(`❓ 未発見: ${finalPath} に ws-resources.json がなかごたあ。`);
  }
}

function absoluteSourcePathToWindows(path: string): string {
  return path.replace(/\//g, '\\').replace(/\\+/g, '\\');
}

/**
 * デフォルトの検索パス（救済用）
 */
export const DEFAULT_SCAN_PATHS: string[] = [];
