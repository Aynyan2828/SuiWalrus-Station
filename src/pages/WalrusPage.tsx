// ==========================================
// Walrus操作ページ
// ==========================================
import React, { useState } from 'react';
import { useAppState } from '../store/app-store';
import { executeCommand } from '../services/cli-runner';
import { analyzeCommand } from '../services/ai-guard-service';
import { WALRUS_TEMPLATES, SITE_BUILDER_TEMPLATES } from '../utils/command-templates';
import * as settingsService from '../services/settings-service';
import { readBlobViaAggregator, downloadBlob, type BlobPreviewResult } from '../services/walrus-service';
import type { CommandTemplate, AiGuardResult, CommandHistoryEntry, TemplateArg } from '../types';
import { useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';

const ALL_WALRUS_TEMPLATES = [...WALRUS_TEMPLATES, ...SITE_BUILDER_TEMPLATES];

export function WalrusPage() {
  const { state, dispatch, addLog, refreshWalrus } = useAppState();
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [rawCommand, setRawCommand] = useState('');
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastOutput, setLastOutput] = useState('');
  const [aiResult, setAiResult] = useState<AiGuardResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showFallback, setShowFallback] = useState(false); // ← フォールバック表示用
  const [pendingCommand, setPendingCommand] = useState<string[]>([]);
  const [pendingCliType, setPendingCliType] = useState<'sui' | 'walrus' | 'site-builder'>('walrus');

  const [activeTab, setActiveTab] = useState<string>('Blob一覧');
  const [commandPreview, setCommandPreview] = useState('');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [showRawLog, setShowRawLog] = useState<Record<string, boolean>>({});

  // プレビュー用State
  const [previewData, setPreviewData] = useState<BlobPreviewResult | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const toggleRawLog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 行の開閉を防ぐ
    setShowRawLog(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePreviewBlob = async (blobId: string) => {
    setIsPreviewLoading(true);
    setPreviewData(null);
    try {
      addLog('info', 'Walrus', `Blob内容を取得中... (${blobId.slice(0, 8)}...)`);
      const isMainnet = state.activeEnv.toLowerCase().includes('mainnet');
      const data = await readBlobViaAggregator(blobId, isMainnet);
      setPreviewData(data);
      addLog('info', 'Walrus', `Blob取得完了 (Type: ${data.contentType})`);
    } catch (e) {
      addLog('error', 'Walrus', String(e));
      alert(`プレビューエラー: ${e}`);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownloadBlob = (blobId: string) => {
    const isMainnet = state.activeEnv.toLowerCase().includes('mainnet');
    downloadBlob(blobId, isMainnet);
    addLog('info', 'Walrus', `Blobのダウンロードを開始しました (${blobId.slice(0, 8)}...)`);
  };

  const categories = ['Blob一覧', ...new Set(ALL_WALRUS_TEMPLATES.map(t => t.category)), '実行履歴'];


  const quoteArg = (arg: string) => {
    if (arg.includes(' ') && !arg.startsWith('"') && !arg.endsWith('"')) {
      return `"${arg}"`;
    }
    return arg;
  };

  const buildArgs = (template: CommandTemplate): string[] => {
    const flags: string[] = [];
    const positionals: string[] = [];

    const baseCommand = template.command.split(' ');
    
    template.args.forEach((arg) => {
      const val = argValues[arg.name];
      if (val) {
        if (arg.arg_style === 'positional') {
          positionals.push(val);
        } else {
          // Default to flag style
          const flagName = arg.flag_name || (arg.name.includes('-') ? `--${arg.name}` : `--${arg.name}`);
          flags.push(flagName, val);
        }
      }
    });

    let finalArgs = [...baseCommand, ...flags, ...positionals];

    // site-builder の場合、設定ファイルパスがあれば自動注入
    if (template.cli_type === 'site-builder' && state.settings.site_builder_config_path) {
      if (!finalArgs.includes('--config')) {
        // 先頭（update等のサブコマンドの前）に追加
        finalArgs = ['--config', state.settings.site_builder_config_path, ...finalArgs];
      }
    }

    return finalArgs;
  };

  // プレビューの更新
  useEffect(() => {
    if (selectedTemplate) {
      const args = buildArgs(selectedTemplate);
      const cliName = selectedTemplate.cli_type;
      const displayArgs = args.map(quoteArg).join(' ');
      setCommandPreview(`${cliName} ${displayArgs}`);
    } else {
      setCommandPreview('');
    }
  }, [selectedTemplate, argValues, state.settings.site_builder_config_path]);

  const executeCommandFlow = async (args: string[], cliType: 'sui' | 'walrus' | 'site-builder' = 'walrus') => {
    setIsExecuting(true);
    setLastOutput('');
    
    let cliPath = state.settings.walrus_cli_path;
    let cliName = 'walrus';

    if (cliType === 'site-builder') {
      cliPath = state.settings.site_builder_cli_path;
      cliName = 'site-builder';
      
      if (state.settings.site_builder_config_path && !args.includes('--config')) {
        args = ['--config', state.settings.site_builder_config_path, ...args];
      }
    }

    // 表示用のコマンド文字列（スペースがあればクォート）
    const commandStr = `${cliName} ${args.map(quoteArg).join(' ')}`;

    addLog('info', cliName, `$ ${commandStr}`, { cli_path: cliPath });
    if (cliType === 'site-builder') {
      addLog('warn', 'Walrus', '🚀 サイトの処理を開始したばい！ファイル数が多いと数分〜数十分かかることがあるけん、そのまま待っとってね。');
    }

    // リアルタイム実況コンソールの開始
    dispatch({ type: 'START_EXECUTION', command: commandStr });

    try {
      const result = await executeCommand(
        cliType, 
        args, 
        state.settings.sui_cli_path, // 追加：Suiへのパス
        state.settings.walrus_cli_path,
        state.settings.site_builder_cli_path
      );

      // 実況コンソールの終了通知
      dispatch({ type: 'END_EXECUTION', status: result.success ? 'success' : 'error' });

      setLastOutput(result.success ? result.stdout : result.stderr);
      
      const statusIcon = result.success ? '✅' : '❌';
      addLog(
        result.success ? 'info' : 'error',
        cliName,
        `${statusIcon} ${commandStr} (Exit: ${result.exit_code}, ${result.duration_ms}ms)`,
        { cli_path: result.cli_path }
      );

      // Windows 不正命令クラッシュ (-1073741795) の検知
      if (!result.success && result.exit_code === -1073741795 && cliType === 'site-builder') {
        setShowFallback(true);
      } else {
        setShowFallback(false);
      }

      const entry: CommandHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        command: commandStr,
        cli_type: cliType,
        category: selectedTemplate?.category || 'manual',
        wallet_address: state.activeAddress,
        network: state.activeEnv,
        status: result.success ? 'success' : 'error',
        stdout: result.stdout,
        stderr: result.stderr,
        raw_stdout: result.raw_stdout,
        raw_stderr: result.raw_stderr,
        exit_code: result.exit_code,
        duration_ms: result.duration_ms,
        executed_at: new Date().toISOString(),
        ai_risk_level: aiResult?.risk_level,
        ai_explanation: aiResult?.summary,
      };
      dispatch({ type: 'ADD_HISTORY', entry });
      const updatedHistory = [entry, ...state.history].slice(0, 500);
      await settingsService.saveCommandHistory(updatedHistory);

      // site-builder の実行が成功した場合は情報をリフレッシュ
      if (result.success && cliType === 'site-builder') {
        setTimeout(() => refreshWalrus(), 1500); // プロセス終了後の反映待ち時間を考慮
      }
    } catch (error) {
      addLog('error', cliName, `❌ 実行エラー: ${error}`);
      setLastOutput(`エラー: ${error}`);
    } finally {
      setIsExecuting(false);
      setAiResult(null);
      setShowConfirm(false);
    }
  };

  const handleExecuteTemplate = async () => {
    if (!selectedTemplate) return;
    const args = buildArgs(selectedTemplate);
    await handlePreExecution(args, selectedTemplate.cli_type);
  };

  const handleExecuteRaw = async () => {
    if (!rawCommand.trim()) return;
    
    // 引用符を考慮したスマートなパース
    const regex = /(?:[^\s"]+|"[^"]*")+/g;
    const matches = rawCommand.match(regex) || [];
    const args = matches.map(arg => {
      // 両端のダブルクォートを取り除く
      if (arg.startsWith('"') && arg.endsWith('"')) {
        return arg.substring(1, arg.length - 1);
      }
      return arg;
    });

    await handlePreExecution(args, 'walrus');
  };

  const handlePreExecution = async (args: string[], cliType: 'sui' | 'walrus' | 'site-builder') => {
    const cliName = cliType === 'site-builder' ? 'site-builder' : cliType;
    const cmdForAi = `${cliName} ${args.map(quoteArg).join(' ')}`;

    // 速攻で実行中にする
    setIsExecuting(true);
    dispatch({ type: 'START_EXECUTION', command: cmdForAi });
    addLog('info', 'AI Guard', `🧐 安全判定中ばい...: ${cmdForAi}`);

    if (state.aiMode !== 'off') {
      try {
        const result = await analyzeCommand(
          cmdForAi,
          cliType as any,
          state.activeEnv,
          state.activeAddress,
          state.settings,
        );
        setAiResult(result);

        if (state.aiMode === 'guard' && result.risk_level !== 'low') {
          addLog('warn', 'AI Guard', `⚠️ 高リスク検知: ${result.summary}`);
          setPendingCommand(args);
          setPendingCliType(cliType);
          setShowConfirm(true);
          // この時点では実行は一旦停止（確認待ち）
          dispatch({ type: 'END_EXECUTION', status: 'error' });
          setIsExecuting(false);
          return;
        }
        addLog('info', 'AI Guard', `✅ 安全確認完了 (リスク: ${result.risk_level})`);
      } catch (err) {
        addLog('warn', 'AI Guard', `⚠️ AI判定スキップ: ${err}`);
      }
    }

    await executeCommandFlow(args, cliType);
  };

  const selectArgPath = async (arg: TemplateArg) => {
    try {
      const selected = await open({
        directory: arg.path_type === 'directory',
        multiple: false,
        defaultPath: argValues[arg.name] || undefined,
      });
      if (selected && typeof selected === 'string') {
        setArgValues({ ...argValues, [arg.name]: selected });
      }
    } catch (error) {
      addLog('error', 'Walrus', `❌ ダイアログエラー: ${error}`);
    }
  };

  // 初期読み込み
  useEffect(() => {
    refreshWalrus();
  }, [refreshWalrus]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 className="page-title" style={{ margin: 0 }}>🐋 Walrus 操作</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={isAdvancedMode} onChange={(e) => setIsAdvancedMode(e.target.checked)} />
          上級者モード
        </label>
      </div>

      <div className="tabs">
        {categories.map(cat => (
          <div key={cat} className={`tab ${activeTab === cat ? 'active' : ''}`} onClick={() => setActiveTab(cat)}>
            {cat}
          </div>
        ))}
        {isAdvancedMode && (
          <div className={`tab ${activeTab === 'CLI' ? 'active' : ''}`} onClick={() => setActiveTab('CLI')}>
            CLI入力
          </div>
        )}
      </div>

      {activeTab === 'CLI' && isAdvancedMode && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title">⌨️ CLI直接入力</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-walrus)', padding: '8px 0' }}>walrus</span>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={rawCommand}
              onChange={(e) => setRawCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteRaw()}
              placeholder="list-blobs --json"
            />
            <button className="btn btn-success" onClick={handleExecuteRaw} disabled={isExecuting || !rawCommand.trim()}>
              {isExecuting ? '実行中...' : '実行'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'Blob一覧' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📦 保存済み Blob / サイト一覧</h3>
            <button className="btn btn-ghost btn-sm" onClick={refreshWalrus} disabled={state.isLoading}>
              🔄 更新
            </button>
          </div>
          
          {state.walrusBlobs.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
              <p>Blobが見つかりませんでした</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={refreshWalrus}>
                今すぐ取得
              </button>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>サイト名 / Domain</th>
                    <th>Blob ID</th>
                    <th>サイズ</th>
                    <th>状態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {state.walrusBlobs.map((blob) => (
                    <tr key={blob.blob_id}>
                      <td>
                        {blob.site_title ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 600, color: 'var(--color-walrus)' }}>
                                {blob.site_title}
                              </span>
                              {blob.is_local_site && (
                                <span className={`badge ${blob.is_offline ? 'badge-high' : 'badge-low'}`} style={{ fontSize: '9px', padding: '1px 4px' }}>
                                  {blob.is_offline ? '🔴 期限切れ / Off' : '🚀 本物 (Local)'}
                                </span>
                              )}
                            </div>
                            {blob.suins_name && (
                              <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                SuiNS: {blob.suins_name}
                              </span>
                            )}
                            {blob.site_object_id && (
                              <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }} title={blob.site_object_id}>
                                Site ID: {blob.site_object_id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
                            未割り当て / 残骸
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: '10px', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }} title={blob.blob_id}>
                        {blob.blob_id}
                      </td>
                      <td className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {blob.is_offline ? '-' : formatSize(blob.size)}
                      </td>
                      <td>
                        <span className={`badge ${blob.is_offline ? 'badge-high' : blob.status === 'certified' ? 'badge-low' : 'badge-medium'}`}>
                          {blob.is_offline ? 'expired' : (blob.status || 'active')}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {blob.site_url && (
                            <a 
                              href={blob.site_url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="btn btn-ghost btn-sm"
                              title="ブラウザでサイトを開く"
                              style={{ textDecoration: 'none', fontSize: '16px' }}
                            >
                              🌐
                            </a>
                          )}
                          <button 
                            className="btn btn-ghost btn-sm" 
                            title="Blob IDをコピー"
                            onClick={() => {
                              navigator.clipboard.writeText(blob.blob_id);
                              addLog('info', 'System', 'Blob IDをクリップボードにコピーしました');
                            }}
                          >
                            📋
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="プレビュー"
                            onClick={() => handlePreviewBlob(blob.blob_id)}
                          >
                            👁️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            title="ダウンロード"
                            onClick={() => handleDownloadBlob(blob.blob_id)}
                          >
                            💾
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Blobプレビューモーダル */}
      {(previewData || isPreviewLoading) && (
        <div className="modal-overlay" onClick={() => { if (!isPreviewLoading) setPreviewData(null); }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 800, width: '90%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h3 className="modal-title" style={{ margin: 0 }}>👁️ Blob プレビュー</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPreviewData(null)} disabled={isPreviewLoading}>
                ✕
              </button>
            </div>
            
            {isPreviewLoading ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-2xl)', color: 'var(--color-text-muted)' }}>
                読み込み中...
              </div>
            ) : previewData ? (
              <div>
                <div style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'flex', gap: 16 }}>
                  <span>ID: <code className="mono">{previewData.blobId.slice(0, 12)}...</code></span>
                  <span>Type: <code>{previewData.contentType}</code></span>
                  <span>Size: {formatSize(previewData.size)}</span>
                </div>
                
                <div style={{ background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-md)', maxHeight: '60vh', overflow: 'auto' }}>
                  {previewData.isImage && previewData.dataUrl ? (
                    <img src={previewData.dataUrl} alt="Blob Preview" style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }} />
                  ) : previewData.isText && previewData.textContent ? (
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontSize: 'var(--text-sm)' }}>
                      {previewData.textContent}
                    </pre>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--space-lg)' }}>
                      <p>このデータ型（{previewData.contentType}）はプレビューできません。</p>
                      <button className="btn btn-primary" style={{ marginTop: 'var(--space-md)' }} onClick={() => handleDownloadBlob(previewData.blobId)}>
                        💾 ダウンロードして確認
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {activeTab === '実行履歴' && (
        <div className="card">
          <h3 className="card-title">📜 実行履歴</h3>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>CLI</th>
                  <th>コマンド</th>
                  <th>ステータス</th>
                </tr>
              </thead>
              <tbody>
                {[...state.history].reverse().map((entry) => (
                  <React.Fragment key={entry.id}>
                    <tr 
                      onClick={() => setExpandedHistoryId(expandedHistoryId === entry.id ? null : entry.id)}
                      style={{ cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ fontSize: 'var(--text-xs)' }}>{new Date(entry.executed_at).toLocaleString()}</td>
                      <td><span className="badge badge-low">{entry.cli_type}</span></td>
                      <td className="mono" style={{ fontSize: 'var(--text-xs)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.command}</td>
                      <td>
                        <span className={`badge ${entry.status === 'success' ? 'badge-low' : 'badge-high'}`}>
                          {entry.status === 'success' ? 'OK' : 'ERR'}
                        </span>
                        <span style={{ marginLeft: 8, fontSize: '10px' }}>{expandedHistoryId === entry.id ? '▼' : '▶'}</span>
                      </td>
                    </tr>
                    {expandedHistoryId === entry.id && (
                      <tr>
                        <td colSpan={4} style={{ padding: '0 16px 16px 16px' }}>
                          <div style={{ 
                            background: 'rgba(0,0,0,0.3)', 
                            padding: '12px', 
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-mono)',
                            position: 'relative'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                              <div style={{ color: 'var(--color-text-muted)' }}>
                                FULL COMMAND: <span style={{ color: 'var(--color-walrus)' }}>$ {entry.command}</span>
                              </div>
                              <button 
                                className="btn btn-ghost btn-xs" 
                                onClick={(e) => toggleRawLog(entry.id, e)}
                                style={{ fontSize: '9px', padding: '2px 6px' }}
                              >
                                {showRawLog[entry.id] ? '✨ 整形ログを表示' : '📟 生ログを表示'}
                              </button>
                            </div>

                            {/* STDOUT 表示 */}
                            {(showRawLog[entry.id] ? entry.raw_stdout : entry.stdout) && (
                              <div style={{ color: 'var(--color-text-primary)', marginBottom: 8 }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  [STDOUT] {showRawLog[entry.id] && <span style={{ fontSize: '9px', opacity: 0.6 }}>(生データ/ANSIあり)</span>}
                                </div>
                                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                  {showRawLog[entry.id] ? entry.raw_stdout : entry.stdout}
                                </pre>
                              </div>
                            )}

                            {/* STDERR 表示 */}
                            {(showRawLog[entry.id] ? entry.raw_stderr : entry.stderr) && (
                              <div style={{ color: 'var(--color-error)' }}>
                                <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                                  [STDERR] {showRawLog[entry.id] && <span style={{ fontSize: '9px', opacity: 0.6 }}>(生データ/ANSIあり)</span>}
                                </div>
                                <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                                  {showRawLog[entry.id] ? entry.raw_stderr : entry.stderr}
                                </pre>
                              </div>
                            )}

                            {!(showRawLog[entry.id] ? (entry.raw_stdout || entry.raw_stderr) : (entry.stdout || entry.stderr)) && (
                              <div style={{ color: 'var(--color-text-muted)' }}>出力はありませんでした</div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab !== 'CLI' && activeTab !== 'Blob一覧' && activeTab !== '実行履歴' && (
        <div className="template-grid">
          {ALL_WALRUS_TEMPLATES.filter(t => t.category === activeTab).map((template) => (
            <div
              key={template.id}
              className="template-card"
              onClick={() => { setSelectedTemplate(template); setArgValues({}); setLastOutput(''); setAiResult(null); }}
              style={selectedTemplate?.id === template.id ? { borderColor: 'var(--color-walrus)', background: 'rgba(0, 204, 136, 0.05)' } : {}}
            >
              <div className="template-name">
                <span className={`badge badge-${template.risk_level}`}>
                  {template.risk_level === 'low' ? '🟢' : template.risk_level === 'medium' ? '🟡' : '🔴'}
                </span>
                {template.name}
              </div>
              <div className="template-desc">{template.description}</div>
              <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {template.cli_type === 'site-builder' ? 'site-builder' : 'walrus'} {template.command}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedTemplate && activeTab !== 'CLI' && activeTab !== '実行履歴' && (
        <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
          <h3 className="card-title">{selectedTemplate.name}</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>{selectedTemplate.description}</p>

          {selectedTemplate.args.filter(arg => isAdvancedMode || !arg.advanced).map((arg) => (
            <div className="form-group" key={arg.name}>
              <label className="form-label">{arg.name} {arg.required && <span style={{ color: 'var(--color-error)' }}>*</span>}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  value={argValues[arg.name] || arg.default_value || ''}
                  onChange={(e) => setArgValues({ ...argValues, [arg.name]: e.target.value })}
                  placeholder={arg.description}
                />
                {arg.is_path && (
                  <button className="btn btn-ghost" onClick={() => selectArgPath(arg)} title={arg.path_type === 'directory' ? 'フォルダを選択' : 'ファイルを選択'}>
                    📂
                  </button>
                )}
              </div>
            </div>
          ))}

          {/* コマンドプレビュー表示 */}
          {commandPreview && (
            <div style={{ 
              background: 'rgba(0,0,0,0.2)', 
              padding: '12px', 
              borderRadius: '8px', 
              marginBottom: '16px',
              border: '1px solid var(--color-border)'
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: '4px' }}>実行予定のコマンド:</div>
              <code style={{ fontSize: 'var(--text-sm)', color: 'var(--color-walrus)', wordBreak: 'break-all' }}>$ {commandPreview}</code>
            </div>
          )}

          <button
            className={`btn ${selectedTemplate.risk_level === 'high' ? 'btn-danger' : 'btn-success'}`}
            onClick={handleExecuteTemplate}
            disabled={isExecuting}
          >
            {isExecuting ? '実行中...' : selectedTemplate.risk_level === 'high' ? '⚠️ 実行' : '▶ 実行'}
          </button>
        </div>
      )}

      {aiResult && (
        <div className={`ai-guard-panel risk-${aiResult.risk_level}`} style={{ marginTop: 'var(--space-lg)' }}>
          <div className="ai-guard-header">
            <span style={{ fontWeight: 600 }}>🤖 AIガード判定</span>
            <span className={`badge badge-${aiResult.risk_level}`}>
              {aiResult.risk_level === 'low' ? '🟢 低リスク' : aiResult.risk_level === 'medium' ? '🟡 中リスク' : '🔴 高リスク'}
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-sm)' }}>{aiResult.summary}</p>
          {aiResult.warnings.length > 0 && (
            <ul className="ai-guard-warnings">{aiResult.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          )}
          <div className="ai-guard-recommendation">{aiResult.recommendation}</div>
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">⚠️ 実行確認</h3>
            <div style={{ background: 'var(--color-bg-primary)', padding: 12, borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              {pendingCliType === 'site-builder' ? 'site-builder' : 'walrus'} {pendingCommand.join(' ')}
            </div>
            {aiResult && (
              <div className={`ai-guard-panel risk-${aiResult.risk_level}`} style={{ margin: '12px 0' }}>
                <span className={`badge badge-${aiResult.risk_level}`}>{aiResult.risk_level.toUpperCase()}</span>
                <p style={{ fontSize: 'var(--text-sm)', marginTop: 8 }}>{aiResult.summary}</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowConfirm(false); setAiResult(null); }}>キャンセル</button>
              <button className="btn btn-danger" onClick={() => executeCommandFlow(pendingCommand, pendingCliType)}>実行する</button>
            </div>
          </div>
        </div>
      )}

      {lastOutput && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="section-title">📤 実行結果</h3>
            {true && ( // 常に終了コードを表示
              <span className={`badge ${lastOutput.includes('❌') || showFallback ? 'badge-high' : 'badge-low'}`} style={{ fontSize: '10px' }}>
                EXIT CODE: {state.history[0]?.exit_code ?? 'N/A'}
              </span>
            )}
          </div>

          {showFallback && (
            <div className="ai-guard-panel risk-high" style={{ marginBottom: 'var(--space-md)', borderColor: 'var(--color-error)' }}>
              <div style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                🚨 Windows環境限定のクラッシュを検知しました
              </div>
              <p style={{ fontSize: 'var(--text-ms)', marginBottom: 12 }}>
                <code>site-builder update</code> が不正命令 (Illegal Instruction) で異常終了しました。
                これはWindows版バイナリの既知の問題です。より安定した <code>deploy</code> コマンドでの再試行を推奨します。
              </p>
              <button 
                className="btn btn-danger" 
                onClick={() => executeCommandFlow([], 'site-builder')}
                style={{ width: '100%' }}
              >
                🛠️ 一括デプロイ (deploy) で再試行する
              </button>
            </div>
          )}

          <div className="cli-output" style={showFallback ? { borderColor: 'var(--color-error)' } : {}}>
            {lastOutput}
          </div>
        </div>
      )}
    </div>
  );
}
