// ==========================================
// トランザクション履歴タブ - SDK経由でオンチェーン履歴を表示
// ==========================================
import { useState, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';
import { getTxExplorerUrl } from '../../utils/explorer-utils';

export function TransactionHistoryTab() {
  const { state, addLog } = useAppState();
  const [txs, setTxs] = useState<sdkService.SdkTxHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchTxHistory = async (cursor?: string) => {
    if (!state.activeAddress || !state.activeEnv) {
      setError('アクティブアドレスまたはネットワークが設定されとらんばい。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      addLog('info', 'SDK', 'オンチェーントランザクション履歴を取得中...');
      const res = await sdkService.getTransactionHistory(
        state.activeAddress,
        state.activeEnv,
        cursor,
        20,
      );
      if (cursor) {
        setTxs(prev => [...prev, ...res.transactions]);
      } else {
        setTxs(res.transactions);
      }
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      addLog('info', 'SDK', `${res.transactions.length}件のトランザクションを取得しました`);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      addLog('error', 'SDK', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (state.activeAddress && state.activeEnv) fetchTxHistory();
  }, [state.activeAddress, state.activeEnv]);

  const formatTime = (timestampMs: string) => {
    try {
      const ms = parseInt(timestampMs);
      if (!ms) return '-';
      return new Date(ms).toLocaleString('ja-JP');
    } catch {
      return '-';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'success') return '✅';
    if (status === 'failure') return '❌';
    return '⏳';
  };

  const getKindLabel = (kind: string) => {
    if (kind === 'ProgrammableTransaction') return 'PTB';
    return kind;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h3 className="section-title" style={{ margin: 0 }}>📜 オンチェーン Tx 履歴</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => fetchTxHistory()} disabled={loading}>
          {loading ? '取得中...' : '🔄 再読み込み'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-error)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>❌ {error}</p>
        </div>
      )}

      {!loading && txs.length === 0 && !error && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>トランザクション履歴が見つかりませんでした。</p>
        </div>
      )}

      {txs.length > 0 && (
        <div className="card">
          <div className="table-container" style={{ maxHeight: 500, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>日時</th>
                  <th>Digest</th>
                  <th>種別</th>
                  <th>Gas (SUI)</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {txs.map(tx => (
                  <tr key={tx.digest}>
                    <td className="mono" style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                      {formatTime(tx.timestampMs)}
                    </td>
                    <td className="mono" style={{ fontSize: '10px', color: 'var(--color-sui)' }}>
                      <span
                        style={{ cursor: 'pointer' }}
                        onClick={() => { navigator.clipboard.writeText(tx.digest); addLog('info', 'SDK', 'Digestをコピーしました'); }}
                        title="クリックでコピー"
                      >
                        {tx.digest.slice(0, 10)}...{tx.digest.slice(-6)}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-sui" style={{ fontSize: '9px' }}>
                        {getKindLabel(tx.kind)}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                      {tx.gasUsed}
                    </td>
                    <td>
                      <span className={`badge ${tx.status === 'success' ? 'badge-low' : 'badge-high'}`}>
                        {getStatusIcon(tx.status)}
                      </span>
                    </td>
                    <td>
                      <a
                        href={getTxExplorerUrl(tx.digest, state.activeEnv)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-ghost btn-sm"
                        style={{ textDecoration: 'none', fontSize: '14px', padding: '2px 6px' }}
                        title="Suiscan で表示"
                      >
                        🔍
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 'var(--space-md)', width: '100%' }}
              onClick={() => fetchTxHistory(nextCursor || undefined)}
              disabled={loading}
            >
              {loading ? '読み込み中...' : 'さらに読み込む'}
            </button>
          )}
        </div>
      )}

      {loading && txs.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)', color: 'var(--color-text-muted)' }}>
          トランザクション履歴を取得中...
        </div>
      )}
    </div>
  );
}
