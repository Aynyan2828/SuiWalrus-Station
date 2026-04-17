// ==========================================
// Sui操作ページ - コマンドテンプレート + CLI実行
// ==========================================
import { useState } from 'react';
import { useAppState } from '../store/app-store';
import { executeCommand } from '../services/cli-runner';
import { analyzeCommand } from '../services/ai-guard-service';
import { SUI_TEMPLATES } from '../utils/command-templates';
import * as settingsService from '../services/settings-service';
import type { CommandTemplate, AiGuardResult, CommandHistoryEntry } from '../types';

export function SuiPage() {
  const { state, dispatch, addLog } = useAppState();
  const [selectedTemplate, setSelectedTemplate] = useState<CommandTemplate | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [rawCommand, setRawCommand] = useState('');
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastOutput, setLastOutput] = useState('');
  const [aiResult, setAiResult] = useState<AiGuardResult | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<string>('情報');
  const categories = [...new Set(SUI_TEMPLATES.map(t => t.category))];

  // テンプレートからコマンド引数を構築
  const buildArgs = (template: CommandTemplate): string[] => {
    const parts = template.command.split(' ');
    template.args.forEach((arg) => {
      const val = argValues[arg.name];
      if (val) {
        if (arg.name.includes('-')) {
          parts.push(`--${arg.name}`, val);
        } else {
          parts.push(val);
        }
      }
    });
    return parts;
  };

  // コマンド実行
  const executeCommandFlow = async (args: string[]) => {
    setIsExecuting(true);
    setLastOutput('');
    const commandStr = `sui ${args.join(' ')}`;

    addLog('info', 'Sui', `$ ${commandStr}`, { cli_path: state.settings.sui_cli_path });

    try {
      const result = await executeCommand('sui', args, state.settings.sui_cli_path);

      setLastOutput(result.success ? result.stdout : result.stderr);
      addLog(
        result.success ? 'info' : 'error',
        'Sui',
        `${result.success ? '✅' : '❌'} ${commandStr} (${result.duration_ms}ms)`,
        { cli_path: result.cli_path }
      );

      // 履歴保存
      const entry: CommandHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        command: commandStr,
        cli_type: 'sui',
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
    } catch (error) {
      addLog('error', 'Sui', `❌ 実行エラー: ${error}`);
      setLastOutput(`エラー: ${error}`);
    } finally {
      setIsExecuting(false);
      setAiResult(null);
      setShowConfirm(false);
    }
  };

  // テンプレート実行ボタン
  const handleExecuteTemplate = async () => {
    if (!selectedTemplate) return;
    const args = buildArgs(selectedTemplate);
    await handlePreExecution(args);
  };

  // 生コマンド実行
  const handleExecuteRaw = async () => {
    if (!rawCommand.trim()) return;
    const args = rawCommand.trim().split(/\s+/);
    await handlePreExecution(args);
  };

  // 実行前処理（AIガード）
  const handlePreExecution = async (args: string[]) => {
    const commandStr = args.join(' ');

    if (state.aiMode !== 'off') {
      addLog('info', 'AIガード', `コマンドを分析中: ${commandStr}`);
      const result = await analyzeCommand(
        `sui ${commandStr}`,
        'sui',
        state.activeEnv,
        state.activeAddress,
        state.settings,
      );
      setAiResult(result);

      if (state.aiMode === 'guard' && result.risk_level !== 'low') {
        setPendingCommand(args);
        setShowConfirm(true);
        return;
      }
    }

    await executeCommandFlow(args);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 className="page-title" style={{ margin: 0 }}>🔗 Sui 操作</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isAdvancedMode}
            onChange={(e) => setIsAdvancedMode(e.target.checked)}
          />
          上級者モード
        </label>
      </div>

      {/* タブ */}
      <div className="tabs">
        {categories.map(cat => (
          <div
            key={cat}
            className={`tab ${activeTab === cat ? 'active' : ''}`}
            onClick={() => setActiveTab(cat)}
          >
            {cat}
          </div>
        ))}
        {isAdvancedMode && (
          <div
            className={`tab ${activeTab === 'CLI' ? 'active' : ''}`}
            onClick={() => setActiveTab('CLI')}
          >
            CLI入力
          </div>
        )}
      </div>

      {/* CLI生入力モード */}
      {activeTab === 'CLI' && isAdvancedMode && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title">⌨️ CLI直接入力</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '8px 0' }}>
            `sui client` 以降の引数を入力してください
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-sui)', padding: '8px 0' }}>sui</span>
            <input
              className="form-input"
              style={{ flex: 1 }}
              value={rawCommand}
              onChange={(e) => setRawCommand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleExecuteRaw()}
              placeholder="client balance --json"
            />
            <button
              className="btn btn-primary"
              onClick={handleExecuteRaw}
              disabled={isExecuting || !rawCommand.trim()}
            >
              {isExecuting ? '実行中...' : '実行'}
            </button>
          </div>
        </div>
      )}

      {/* テンプレート一覧 */}
      {activeTab !== 'CLI' && (
        <div className="template-grid">
          {SUI_TEMPLATES.filter(t => t.category === activeTab).map((template) => (
            <div
              key={template.id}
              className={`template-card ${selectedTemplate?.id === template.id ? 'active' : ''}`}
              onClick={() => {
                setSelectedTemplate(template);
                setArgValues({});
                setLastOutput('');
                setAiResult(null);
              }}
              style={selectedTemplate?.id === template.id ? { borderColor: 'var(--color-sui)', background: 'rgba(77, 166, 255, 0.05)' } : {}}
            >
              <div className="template-name">
                <span className={`badge badge-${template.risk_level}`}>
                  {template.risk_level === 'low' ? '🟢' : template.risk_level === 'medium' ? '🟡' : '🔴'}
                </span>
                {template.name}
              </div>
              <div className="template-desc">{template.description}</div>
              <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                sui {template.command}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 選択中テンプレートの引数入力 */}
      {selectedTemplate && activeTab !== 'CLI' && (
        <div className="card" style={{ marginTop: 'var(--space-lg)' }}>
          <h3 className="card-title">{selectedTemplate.name}</h3>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            {selectedTemplate.description}
          </p>

          {selectedTemplate.args
            .filter(arg => isAdvancedMode || !arg.advanced)
            .map((arg) => (
              <div className="form-group" key={arg.name}>
                <label className="form-label">
                  {arg.name} {arg.required && <span style={{ color: 'var(--color-error)' }}>*</span>}
                </label>
                {arg.type === 'select' ? (
                  <select
                    className="form-input"
                    value={argValues[arg.name] || arg.default_value || ''}
                    onChange={(e) => setArgValues({ ...argValues, [arg.name]: e.target.value })}
                  >
                    <option value="">選択してください</option>
                    {arg.options?.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    value={argValues[arg.name] || arg.default_value || ''}
                    onChange={(e) => setArgValues({ ...argValues, [arg.name]: e.target.value })}
                    placeholder={arg.description}
                  />
                )}
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                  {arg.description}
                </span>
              </div>
            ))}

          <button
            className={`btn ${selectedTemplate.risk_level === 'high' ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleExecuteTemplate}
            disabled={isExecuting}
          >
            {isExecuting ? '実行中...' : selectedTemplate.risk_level === 'high' ? '⚠️ 実行' : '▶ 実行'}
          </button>
        </div>
      )}

      {/* AIガードパネル */}
      {aiResult && (
        <div className={`ai-guard-panel risk-${aiResult.risk_level}`} style={{ marginTop: 'var(--space-lg)' }}>
          <div className="ai-guard-header">
            <span style={{ fontWeight: 600 }}>🤖 AIガード判定</span>
            <span className={`badge badge-${aiResult.risk_level}`}>
              {aiResult.risk_level === 'low' ? '🟢 低リスク' : aiResult.risk_level === 'medium' ? '🟡 中リスク' : '🔴 高リスク'}
            </span>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', marginBottom: 8 }}>{aiResult.summary}</p>
          {aiResult.warnings.length > 0 && (
            <ul className="ai-guard-warnings">
              {aiResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          <div className="ai-guard-recommendation">{aiResult.recommendation}</div>
        </div>
      )}

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">⚠️ 実行確認</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              このコマンドを実行してもよろしいですか？
            </p>
            <div style={{ background: 'var(--color-bg-primary)', padding: 12, borderRadius: 8, margin: '12px 0', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              sui {pendingCommand.join(' ')}
            </div>
            {aiResult && (
              <div className={`ai-guard-panel risk-${aiResult.risk_level}`} style={{ margin: '12px 0' }}>
                <span className={`badge badge-${aiResult.risk_level}`} style={{ marginBottom: 8, display: 'inline-block' }}>
                  {aiResult.risk_level.toUpperCase()}
                </span>
                <p style={{ fontSize: 'var(--text-sm)' }}>{aiResult.summary}</p>
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => { setShowConfirm(false); setAiResult(null); }}>
                キャンセル
              </button>
              <button className="btn btn-danger" onClick={() => executeCommandFlow(pendingCommand)}>
                実行する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 実行結果 */}
      {lastOutput && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <h3 className="section-title">📤 実行結果</h3>
          <div className="cli-output">{lastOutput}</div>
        </div>
      )}
    </div>
  );
}
