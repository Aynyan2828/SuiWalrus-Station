// ==========================================
// ダッシュボード - 概要表示
// ==========================================
import { useAppState } from '../store/app-store';
import { useState, useEffect } from 'react';
import { AiAdvisorService } from '../services/AiAdvisorService';

/**
 * 資産推移を表示する軽量な SVG チャート
 */
function PortfolioChart({ history }: { history: any[] }) {
  if (history.length < 2) {
    return (
      <div className="empty-state" style={{ height: 200, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
        <p style={{ fontSize: 'var(--text-sm)' }}>📊 履歴データを蓄積中ばい（あと {2 - history.length} 日分）</p>
      </div>
    );
  }

  const width = 800;
  const height = 200;
  const padding = 40;

  const balances = history.map(h => h.balance);
  const minBalance = Math.min(...balances) * 0.95;
  const maxBalance = Math.max(...balances) * 1.05;
  const range = maxBalance - minBalance;

  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * (width - padding * 2) + padding;
    const y = height - ((h.balance - minBalance) / range) * (height - padding * 2) - padding;
    return `${x},${y}`;
  }).join(' ');

  const areaPath = `M ${padding},${height - padding} ` + points + ` L ${width - padding},${height - padding} Z`;

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', minWidth: 600 }}>
        {/* グリッド線 */}
        {[0, 0.5, 1].map(v => (
          <line key={v} x1={padding} y1={padding + (height - padding * 2) * v} x2={width - padding} y2={padding + (height - padding * 2) * v} 
            stroke="var(--color-border)" strokeDasharray="4" />
        ))}
        
        {/* エリアグラデーション */}
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-sui)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-sui)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#chartGradient)" />
        
        {/* ライン */}
        <polyline points={points} fill="none" stroke="var(--color-sui)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" 
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 242, 255, 0.4))' }} />
        
        {/* ポイント */}
        {history.map((h, i) => {
          const x = (i / (history.length - 1)) * (width - padding * 2) + padding;
          const y = height - ((h.balance - minBalance) / range) * (height - padding * 2) - padding;
          return <circle key={i} cx={x} cy={y} r="4" fill="var(--color-sui)" stroke="white" strokeWidth="2" />;
        })}

        {/* ラベル */}
        <text x={padding} y={height - 10} fontSize="10" fill="var(--color-text-muted)">{new Date(history[0].timestamp).toLocaleDateString()}</text>
        <text x={width - padding} y={height - 10} fontSize="10" fill="var(--color-text-muted)" textAnchor="end">{new Date(history[history.length - 1].timestamp).toLocaleDateString()}</text>
      </svg>
    </div>
  );
}

export function Dashboard() {
  const { state, dispatch, refreshConnection, refreshWallets } = useAppState();
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    async function getInsight() {
      if (state.portfolioHistory.length > 0 && state.settings.ai_api_key) {
        setLoadingInsight(true);
        try {
          const insight = await AiAdvisorService.generateInsight(
            state.portfolioHistory,
            state.history,
            state.settings
          );
          setAiInsight(insight);
        } catch (e) {
          console.error('Insight generation failed:', e);
        } finally {
          setLoadingInsight(false);
        }
      } else if (!state.settings.ai_api_key) {
        setAiInsight('AI APIキーを設定すると、ここでポートフォリオのアドバイスがもらえるばい！🦾✨');
      } else {
        setAiInsight('まだ資産データが溜まっとらんごたぁ。数日使い続けたら、僕が分析してアドバイスするばい！🦾✨');
      }
    }
    getInsight();
  }, [state.portfolioHistory.length, state.settings.ai_api_key, state.history.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeWallet = state.wallets.find(w => w.is_active);

  return (
    <div className="animate-fadeIn">
      {/* ヒーローセクション: ロゴとウェルカムメッセージ */}
      <div className="card" style={{ 
        marginBottom: 32, 
        textAlign: 'center', 
        background: 'var(--gradient-premium)', 
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '48px 24px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 背景の装飾 */}
        <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '120%', height: '120%', background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
        
        <div style={{
          padding: 12,
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: 28,
          boxShadow: '0 0 40px rgba(0, 255, 170, 0.3)',
          zIndex: 1
        }}>
          <img src="/logo.png" alt="SuiWalrus Logo" style={{ width: 100, height: 100, borderRadius: 20, objectFit: 'cover' }} />
        </div>
        <div style={{ zIndex: 1 }}>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 800, color: 'white', marginBottom: 8, letterSpacing: '-0.04em' }}>
            SuiWalrus Station
          </h2>
          <p style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '1.2rem', fontWeight: 500 }}>
            The Next-Gen Command Center for the Sui Ecosystem
          </p>
        </div>
      </div>

      {/* 🤖 AI アドバイザー・インサイト */}
      <div style={{ marginBottom: 32, animation: 'slideIn 0.5s ease-out' }}>
        <div className="card" style={{ 
          background: 'var(--color-bg-secondary)', 
          border: '1px solid var(--color-sui-light)',
          position: 'relative',
          padding: '24px 24px 24px 80px',
          minHeight: 80,
          display: 'flex',
          alignItems: 'center',
          boxShadow: '0 4px 20px rgba(0, 242, 255, 0.05)'
        }}>
          {/* AI アイコン */}
          <div style={{
            position: 'absolute',
            left: 20,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 44,
            height: 44,
            background: 'var(--color-sui)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            boxShadow: '0 0 15px var(--color-sui)'
          }}>
            🤖
          </div>
          
          <div style={{ fontSize: 'var(--text-sm)', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
            <div style={{ fontWeight: 700, color: 'var(--color-sui)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              Walrus Agent Insight
              {loadingInsight && <span className="cli-status-dot connected" style={{ width: 8, height: 8 }} />}
            </div>
            {loadingInsight ? (
              <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>履歴ば詳細に分析中ばい... ちょっと待っとってね...</span>
            ) : (
              aiInsight || '今日は特にお知らせはなかばい。順調たい！'
            )}
          </div>
        </div>
      </div>

      {/* ステータスカード */}
      <div className="card-grid">
        <div className="stat-card">
          <span className="stat-label">アクティブウォレット</span>
          <span className="stat-value sui" style={{ fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>
            {activeWallet
              ? `${activeWallet.alias} (${activeWallet.address.slice(0, 12)}...)`
              : '未接続'}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">残高</span>
          <span className="stat-value sui">
            {state.balance || '0.0000 SUI'}
          </span>
          {state.tokenBalances.length > 1 && (
            <div style={{ marginTop: 'var(--space-sm)', fontSize: 'var(--text-xs)', opacity: 0.8 }}>
              {state.tokenBalances.filter(t => t.symbol !== 'SUI').map(t => (
                <div key={t.coinType}>{t.formatted}</div>
              ))}
            </div>
          )}
        </div>

        <div className="stat-card">
          <span className="stat-label">ネットワーク</span>
          <span className="stat-value">
            {state.activeEnv || '未接続'}
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-label">登録ウォレット数</span>
          <span className="stat-value">{state.wallets.length}</span>
        </div>
      </div>

      {/* 📈 ポートフォリオ推移チャート */}
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <div className="card" style={{ padding: 'var(--space-lg)' }}>
          <div className="card-header" style={{ marginBottom: 'var(--space-md)' }}>
            <h3 className="card-title">📈 Portfolio Growth (SUI)</h3>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>過去 30 日間の推移</span>
          </div>
          
          <PortfolioChart history={state.portfolioHistory} />
        </div>
      </div>

      {/* CLI接続状態 */}
      <div style={{ marginTop: 'var(--space-xl)' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">🔌 CLI接続状態</h3>
            <button className="btn btn-ghost btn-sm" onClick={refreshConnection}>
              再確認
            </button>
          </div>

          {state.connection ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
              {/* Sui CLI */}
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`cli-status-dot ${state.connection.sui_available ? 'connected' : 'disconnected'}`} />
                  <span className="stat-label">Sui CLI</span>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {state.connection.sui_version}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  📁 {state.connection.sui_path}
                </span>
              </div>

              {/* Walrus CLI */}
              <div className="stat-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`cli-status-dot ${state.connection.walrus_available ? 'connected' : 'disconnected'}`} />
                  <span className="stat-label">Walrus CLI</span>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  {state.connection.walrus_version}
                </span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                  📁 {state.connection.walrus_path}
                </span>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-icon">🔌</span>
              <p>接続確認中...</p>
            </div>
          )}
        </div>
      </div>

      {/* 検出された設定パス */}
      {state.detectedPaths && (
        <div style={{ marginTop: 'var(--space-lg)' }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 'var(--space-md)' }}>
              📂 検出された設定ディレクトリ
            </h3>
            <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Sui設定: </span>
                <span style={{ color: state.detectedPaths.sui_config_dir ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {state.detectedPaths.sui_config_dir || '未検出'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Suiキーストア: </span>
                <span style={{ color: state.detectedPaths.sui_keystore ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {state.detectedPaths.sui_keystore || '未検出'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Walrus設定: </span>
                <span style={{ color: state.detectedPaths.walrus_config_dir ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {state.detectedPaths.walrus_config_dir || '未検出'}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--color-text-muted)' }}>Walrus設定ファイル: </span>
                <span style={{ color: state.detectedPaths.walrus_config_file ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                  {state.detectedPaths.walrus_config_file || '未検出'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 直近の実行履歴 */}
      <div style={{ marginTop: 'var(--space-lg)' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">📜 直近の実行履歴</h3>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => dispatch({ type: 'SET_PAGE', page: 'history' })}
            >
              すべて表示
            </button>
          </div>
          {state.history.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
              <p style={{ fontSize: 'var(--text-sm)' }}>まだ実行履歴がありません</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日時</th>
                    <th>タイプ</th>
                    <th>コマンド</th>
                    <th>状態</th>
                    <th>時間</th>
                  </tr>
                </thead>
                <tbody>
                  {state.history.slice(0, 5).map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono">{new Date(entry.executed_at).toLocaleString('ja-JP')}</td>
                      <td><span className={`badge badge-${entry.cli_type}`}>{entry.cli_type}</span></td>
                      <td className="mono" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.command}
                      </td>
                      <td>
                        <span className={`badge ${entry.status === 'success' ? 'badge-low' : 'badge-high'}`}>
                          {entry.status === 'success' ? '✅' : '❌'}
                        </span>
                      </td>
                      <td className="mono">{entry.duration_ms}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
