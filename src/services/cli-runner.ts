// ==========================================
// CLI実行サービス
// Tauri invoke を通じて既存CLIを呼び出すラッパー
// CLIの再実装は一切しない
// ==========================================
import { invoke } from '@tauri-apps/api/core';
import type { CliResult, ConnectionStatus } from '../types';

/**
 * 既存CLIコマンドを実行する
 * バックエンド(Rust)側でspawn/execして結果を返す
 */
export async function executeCommand(
  cliType: 'sui' | 'walrus' | 'site-builder',
  args: string[],
  suiCliPath?: string,
  walrusCliPath?: string,
  siteBuilderCliPath?: string,
): Promise<CliResult> {
  return invoke<CliResult>('execute_command', {
    cli_type: cliType,
    args,
    sui_cli_path: suiCliPath || undefined,
    walrus_cli_path: walrusCliPath || undefined,
    site_builder_cli_path: siteBuilderCliPath || undefined,
  });
}

/**
 * Sui/Walrus CLIの接続を確認する
 * --version コマンドで疎通チェック
 */
export async function checkCliConnection(
  suiCliPath?: string,
  walrus_cli_path?: string,
  siteBuilderCliPath?: string,
): Promise<ConnectionStatus> {
  return invoke<ConnectionStatus>('check_cli_connection', {
    sui_cli_path: suiCliPath || undefined,
    walrus_cli_path: walrus_cli_path || undefined,
    site_builder_cli_path: siteBuilderCliPath || undefined,
  });
}
