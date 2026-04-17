// ==========================================
// 設定ページ
// CLIパス、AI設定、検出パスの確認・変更
// ==========================================
import { useState, useEffect } from 'react';
import { useAppState } from '../store/app-store';
import * as settingsService from '../services/settings-service';
import type { AppSettings, AiMode } from '../types';
import { open } from '@tauri-apps/plugin-dialog';

import { testAiConnection } from '../services/ai-guard-service';

export function SettingsPage() {
  const { state, dispatch, addLog, refreshConnection } = useAppState();
  const [localSettings, setLocalSettings] = useState<AppSettings>(state.settings);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isAiTesting, setIsAiTesting] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    setLocalSettings(state.settings);
  }, [state.settings]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await settingsService.saveSettings(localSettings);
      dispatch({ type: 'SET_SETTINGS', settings: localSettings });
      addLog('info', '設定', '✅ 設定を保存しました');
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);

      // 接続再確認
      await refreshConnection();
    } catch (error) {
      addLog('error', '設定', `❌ 設定保存エラー: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const update = (key: keyof AppSettings, value: string) => {
    setLocalSettings({ ...localSettings, [key]: value });
  };

  const selectPath = async (key: keyof AppSettings, isDirectory: boolean = false) => {
    try {
      const selected = await open({
        directory: isDirectory,
        multiple: false,
        defaultPath: localSettings[key] as string,
      });
      if (selected && typeof selected === 'string') {
        update(key, selected);
      }
    } catch (error) {
      addLog('error', '設定', `❌ ダイアログエラー: ${error}`);
    }
  };

  const handleAiTest = async () => {
    setIsAiTesting(true);
    setAiTestResult(null);
    try {
      const res = await testAiConnection(localSettings);
      setAiTestResult(res);
      if (res.success) {
        addLog('info', '設定', '🤖 AI接続テストに成功しました');
      } else {
        addLog('error', '設定', `🤖 AI接続テストに失敗しました: ${res.message}`);
      }
    } catch (error) {
      setAiTestResult({ success: false, message: `テスト実行中にエラーが発生しました: ${error}` });
    } finally {
      setIsAiTesting(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2 className="page-title" style={{ margin: 0 }}>⚙️ 設定</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {saved && <span style={{ color: 'var(--color-success)', fontSize: 'var(--text-sm)' }}>✅ 保存しました</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? '保存中...' : '💾 保存'}
          </button>
        </div>
      </div>

      <div className="settings-grid">
        {/* CLI設定 */}
        <div className="card">
          <h3 className="card-title">🔧 CLIパス設定</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
            既存のCLIバイナリパスを指定します。変更後は「保存」→自動で接続確認されます。
          </p>

          <div className="form-group">
            <label className="form-label">Sui CLI パス</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={localSettings.sui_cli_path}
                onChange={(e) => update('sui_cli_path', e.target.value)}
                placeholder="C:\ProgramData\chocolatey\bin\sui"
              />
              <button className="btn btn-ghost" onClick={() => selectPath('sui_cli_path', false)} title="ファイルを選択">
                📂
              </button>
            </div>
            {state.connection && (
              <span style={{ fontSize: 'var(--text-xs)', color: state.connection.sui_available ? 'var(--color-success)' : 'var(--color-error)' }}>
                {state.connection.sui_available ? `✅ ${state.connection.sui_version}` : `❌ ${state.connection.sui_version}`}
              </span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Walrus CLI パス</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={localSettings.walrus_cli_path}
                onChange={(e) => update('walrus_cli_path', e.target.value)}
                placeholder="C:\ProgramData\walrus\walrus"
              />
              <button className="btn btn-ghost" onClick={() => selectPath('walrus_cli_path', false)} title="ファイルを選択">
                📂
              </button>
            </div>
            {state.connection && (
              <span style={{ fontSize: 'var(--text-xs)', color: state.connection.walrus_available ? 'var(--color-success)' : 'var(--color-error)' }}>
                {state.connection.walrus_available ? `✅ ${state.connection.walrus_version}` : `❌ ${state.connection.walrus_version}`}
              </span>
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label">Walrus Site Builder パス</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={localSettings.site_builder_cli_path}
                onChange={(e) => update('site_builder_cli_path', e.target.value)}
                placeholder="C:\ProgramData\walrus\site-builder.exe"
              />
              <button className="btn btn-ghost" onClick={() => selectPath('site_builder_cli_path', false)} title="ファイルを選択">
                📂
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Walrus Site Builder 設定ファイル</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                style={{ flex: 1 }}
                value={localSettings.site_builder_config_path}
                onChange={(e) => update('site_builder_config_path', e.target.value)}
                placeholder="C:\Users\PC USER\...\site-config.yaml"
              />
              <button className="btn btn-ghost" onClick={() => selectPath('site_builder_config_path', false)} title="ファイルを選択">
                📂
              </button>
            </div>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>
              ※ サイトのデプロイや更新に必要ばい。設定ファイルがない場合はエラーになるけん注意してね。
            </p>
          </div>

          <button className="btn btn-ghost btn-sm" onClick={refreshConnection}>
            🔌 接続再確認
          </button>
        </div>

        {/* AI設定 */}
        <div className="card">
          <h3 className="card-title">🤖 AI ガード設定</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
            コマンド実行前の安全判定AIの設定です。APIキー未設定時はローカル分析のみ動作します。
          </p>

          <div className="form-group">
            <label className="form-label">AIモード</label>
            <select
              className="form-input"
              value={localSettings.ai_mode}
              onChange={(e) => update('ai_mode', e.target.value)}
            >
              <option value="guard">🛡️ ガード（判定 + 確認ダイアログ）</option>
              <option value="explain">📖 説明のみ（ブロックしない）</option>
              <option value="off">⚡ オフ（AI判定なし）</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">AIプロバイダー</label>
            <select
              className="form-input"
              value={localSettings.ai_provider}
              onChange={(e) => update('ai_provider', e.target.value)}
            >
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama（ローカル）</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">API ベースURL</label>
            <input
              className="form-input"
              value={localSettings.ai_base_url}
              onChange={(e) => update('ai_base_url', e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Ollama: http://localhost:11434/v1
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">API キー</label>
            <input
              className="form-input"
              type="password"
              value={localSettings.ai_api_key}
              onChange={(e) => update('ai_api_key', e.target.value)}
              placeholder="sk-..."
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              Ollama使用時はダミー値（ollama等）でOK
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">モデル名</label>
            <input
              className="form-input"
              value={localSettings.ai_model}
              onChange={(e) => update('ai_model', e.target.value)}
              placeholder="gpt-4o-mini"
            />
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              例: gpt-4o-mini, llama3.1, qwen2.5
            </span>
          </div>

          <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: 'var(--glass-border)' }}>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleAiTest}
              disabled={isAiTesting}
            >
              {isAiTesting ? '⏳ 接続テスト中...' : '🤖 AI接続テストを実行'}
            </button>
            {aiTestResult && (
              <div style={{ 
                marginTop: 12, 
                fontSize: 'var(--text-xs)', 
                padding: '12px',
                background: aiTestResult.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${aiTestResult.success ? 'var(--color-success)' : 'var(--color-error)'}`,
                borderRadius: 'var(--radius-md)',
                color: aiTestResult.success ? 'var(--color-success)' : 'var(--color-error)',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {aiTestResult.success ? '🎉 接続成功！' : '❌ 接続に失敗したばい'}
                </div>
                <div style={{ lineHeight: 1.5 }}>
                  {aiTestResult.message}
                </div>
                {!aiTestResult.success && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px border rgba(239, 68, 68, 0.2)', opacity: 0.9 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>💡 以下の項目ば確認してみてね：</p>
                    <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <li>URLの最後が <code style={{color: 'white'}}>/v1</code> になっとるか？</li>
                      <li>Ollamaば使うなら、アプリが起動しとるか？</li>
                      <li>OpenAIば使うなら、APIキーが正しいか？</li>
                      <li>URLにタイポ（入力ミス）はなかか？</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 検出パス情報 */}
      <div className="card" style={{ marginTop: 'var(--space-xl)' }}>
        <h3 className="card-title">📂 自動検出された設定パス</h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
          以下は自動検出結果です。既存のCLI環境設定はこのツールでは書き換えません。
        </p>
        {state.detectedPaths ? (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 160, display: 'inline-block' }}>Sui 設定ディレクトリ:</span>
              <span style={{ color: state.detectedPaths.sui_config_dir ? 'var(--color-success)' : 'var(--color-error)' }}>
                {state.detectedPaths.sui_config_dir || '未検出'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 160, display: 'inline-block' }}>Sui キーストア:</span>
              <span style={{ color: state.detectedPaths.sui_keystore ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {state.detectedPaths.sui_keystore || '未検出'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 160, display: 'inline-block' }}>Walrus 設定ディレクトリ:</span>
              <span style={{ color: state.detectedPaths.walrus_config_dir ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {state.detectedPaths.walrus_config_dir || '未検出'}
              </span>
            </div>
            <div>
              <span style={{ color: 'var(--color-text-muted)', minWidth: 160, display: 'inline-block' }}>Walrus 設定ファイル:</span>
              <span style={{ color: state.detectedPaths.walrus_config_file ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                {state.detectedPaths.walrus_config_file || '未検出'}
              </span>
            </div>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>検出中...</p>
        )}
      </div>

      {/* ログレベル */}
      <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
        <h3 className="card-title">📋 その他</h3>
        <div className="form-group">
          <label className="form-label">ログレベル</label>
          <select
            className="form-input"
            value={localSettings.log_level}
            onChange={(e) => update('log_level', e.target.value)}
            style={{ maxWidth: 200 }}
          >
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>
      </div>
    </div>
  );
}
