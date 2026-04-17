// ==========================================
// 実行履歴ページ
// ==========================================
import { useState } from 'react';
import { useAppState } from '../store/app-store';
import * as settingsService from '../services/settings-service';

export function HistoryPage() {
  const { state, dispatch } = useAppState();
  const [filter, setFilter] = useState<'all' | 'sui' | 'walrus'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = state.history.filter((entry) => {
    if (filter !== 'all' && entry.cli_type !== filter) return false;
    if (searchQuery && !entry.command.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleClearHistory = async () => {
    if (confirm('実行履歴をすべて削除しますか？')) {
      dispatch({ type: 'SET_HISTORY', history: [] });
      await settingsService.saveCommandHistory([]);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 className="page-title" style={{ margin: 0 }}>📜 実行履歴</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: '32px' }}>
            {filtered.length}件
          </span>
          <button className="btn btn-ghost btn-sm" onClick={handleClearHistory}>🗑️ クリア</button>
        </div>
      </div>

      {/* フィルタ */}
      <div style={{ display: 'flex', gap: 'var(--space-md)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 'none' }}>
          {(['all', 'sui', 'walrus'] as const).map(f => (
            <div key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'すべて' : f.toUpperCase()}
            </div>
          ))}
        </div>
        <input
          className="form-input"
          style={{ flex: 1, maxWidth: 300 }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 コマンドを検索..."
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📜</span>
          <p>実行履歴がありません</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>タイプ</th>
                  <th>コマンド</th>
                  <th>ネットワーク</th>
                  <th>AI判定</th>
                  <th>状態</th>
                  <th>時間</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <>
                    <tr
                      key={entry.id}
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                        {new Date(entry.executed_at).toLocaleString('ja-JP')}
                      </td>
                      <td><span className={`badge badge-${entry.cli_type}`}>{entry.cli_type}</span></td>
                      <td className="mono" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                        {entry.command}
                      </td>
                      <td><span className="tag">{entry.network || '-'}</span></td>
                      <td>
                        {entry.ai_risk_level && (
                          <span className={`badge badge-${entry.ai_risk_level}`}>
                            {entry.ai_risk_level}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${entry.status === 'success' ? 'badge-low' : 'badge-high'}`}>
                          {entry.status === 'success' ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: 'var(--text-xs)' }}>{entry.duration_ms}ms</td>
                    </tr>
                    {expandedId === entry.id && (
                      <tr key={`${entry.id}-detail`}>
                        <td colSpan={7} style={{ padding: 0 }}>
                          <div style={{ padding: 'var(--space-md)', background: 'var(--color-bg-primary)' }}>
                            {entry.stdout && (
                              <div style={{ marginBottom: 8 }}>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-success)', fontWeight: 600 }}>stdout:</span>
                                <div className="cli-output" style={{ marginTop: 4, maxHeight: 150 }}>{entry.stdout}</div>
                              </div>
                            )}
                            {entry.stderr && (
                              <div>
                                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-error)', fontWeight: 600 }}>stderr:</span>
                                <div className="cli-output" style={{ marginTop: 4, maxHeight: 150 }}>{entry.stderr}</div>
                              </div>
                            )}
                            {entry.ai_explanation && (
                              <div style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                                🤖 AI: {entry.ai_explanation}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
