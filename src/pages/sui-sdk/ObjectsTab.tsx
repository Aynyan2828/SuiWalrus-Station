// ==========================================
// オブジェクトタブ - SDK経由で所有オブジェクト一覧・詳細
// ==========================================
import { useState, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';

export function ObjectsTab() {
  const { state, addLog } = useAppState();
  const [objects, setObjects] = useState<sdkService.SdkOwnedObject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<sdkService.SdkObjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const fetchObjects = async (cursor?: string) => {
    if (!state.activeAddress) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sdkService.getOwnedObjects(state.activeAddress, state.activeEnv, cursor);
      if (cursor) {
        setObjects(prev => [...prev, ...res.objects]);
      } else {
        setObjects(res.objects);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      addLog('info', 'SDK', `オブジェクト ${res.objects.length}件を取得しました`);
    } catch (e) {
      setError(String(e));
      addLog('error', 'SDK', String(e));
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await sdkService.getObjectDetail(id, state.activeEnv);
      setDetail(d);
    } catch (e) {
      addLog('error', 'SDK', String(e));
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (state.activeAddress && state.activeEnv) fetchObjects();
  }, [state.activeAddress, state.activeEnv]);

  const filtered = objects.filter(o =>
    !filter || o.objectId.includes(filter) || o.type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ flex: 1 }}
          placeholder="Object ID または Type でフィルタ..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => fetchObjects()} disabled={loading}>
          {loading ? '取得中...' : '🔄'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-error)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>❌ {error}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-lg)' }}>
        {/* 一覧 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card">
            <h3 className="card-title">📦 所有オブジェクト ({filtered.length}件)</h3>
            <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Object ID</th>
                    <th>Type</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(o => (
                    <tr key={o.objectId}
                      onClick={() => fetchDetail(o.objectId)}
                      style={{ cursor: 'pointer', background: selectedId === o.objectId ? 'rgba(77,166,255,0.1)' : undefined }}>
                      <td className="mono" style={{ color: 'var(--color-sui)' }}>
                        {o.objectId.slice(0, 10)}...{o.objectId.slice(-6)}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.type.split('::').pop()}
                      </td>
                      <td className="mono">{o.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-md)', width: '100%' }}
                onClick={() => fetchObjects(nextCursor || undefined)} disabled={loading}>
                さらに読み込む
              </button>
            )}
          </div>
        </div>

        {/* 詳細パネル */}
        {selectedId && (
          <div style={{ width: 380, flexShrink: 0 }}>
            <div className="card">
              <h3 className="card-title">🔍 詳細</h3>
              {detailLoading && <p style={{ color: 'var(--color-text-muted)' }}>読み込み中...</p>}
              {detail && (
                <div>
                  {[
                    ['Object ID', detail.objectId],
                    ['Type', detail.type],
                    ['Owner', detail.owner.slice(0, 16) + '...'],
                    ['Version', detail.version],
                    ['Digest', detail.digest],
                  ].map(([label, value]) => (
                    <div key={label} style={{ marginBottom: 'var(--space-sm)' }}>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}</div>
                      <div className="mono" style={{ fontSize: 'var(--text-xs)', wordBreak: 'break-all', cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                        onClick={() => { navigator.clipboard.writeText(String(value)); addLog('info', 'SDK', `${label}をコピーしました`); }}>
                        {value}
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-md)', width: '100%' }}
                    onClick={() => setShowRaw(!showRaw)}>
                    {showRaw ? '閉じる' : 'Raw JSON を表示'}
                  </button>
                  {showRaw && (
                    <pre style={{
                      marginTop: 'var(--space-sm)', background: 'var(--color-bg-input)',
                      padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-xs)', maxHeight: 300, overflowY: 'auto',
                      color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all'
                    }}>
                      {detail.rawJson}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
