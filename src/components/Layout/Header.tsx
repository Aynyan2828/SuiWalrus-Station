// ==========================================
// ヘッダー - ウォレット・ネットワーク・残高の常時表示
// ネットワーク切替ドロップダウン付き
// ==========================================
import { useState, useRef, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import * as walletService from '../../services/wallet-service';
import { getAddressExplorerUrl } from '../../utils/explorer-utils';

/** アドレスを短縮表示 */
function shortenAddress(addr: string): string {
  if (!addr || addr.length < 16) return addr;
  return `${addr.slice(0, 8)}...${addr.slice(-6)}`;
}

/** ネットワーク名からバッジクラスを決定 */
function getNetworkClass(env: string): string {
  const lower = env.toLowerCase();
  if (lower.includes('mainnet')) return 'mainnet';
  if (lower.includes('testnet')) return 'testnet';
  if (lower.includes('devnet')) return 'devnet';
  return 'unknown';
}

const NETWORKS = ['mainnet', 'testnet', 'devnet'] as const;

export function Header() {
  const { state, refreshWallets, refreshConnection, addLog } = useAppState();
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNetworkDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSwitchNetwork = async (env: string) => {
    if (state.activeEnv.toLowerCase().includes(env.toLowerCase())) {
      setShowNetworkDropdown(false);
      return; // 同じネットワークなら何もしない
    }
    setSwitching(true);
    try {
      addLog('info', 'ネットワーク', `🔄 ${env} に切替中...`);
      await walletService.switchEnv(env, state.settings.sui_cli_path);
      addLog('info', 'ネットワーク', `✅ ${env} に切替完了！`);
      await refreshConnection();
      await refreshWallets();
    } catch (error) {
      addLog('error', 'ネットワーク', `❌ 切替失敗: ${error}`);
    } finally {
      setSwitching(false);
      setShowNetworkDropdown(false);
    }
  };

  const explorerUrl = state.activeAddress
    ? getAddressExplorerUrl(state.activeAddress, state.activeEnv)
    : '';

  return (
    <header className="header">
      <div className="header-left">
        {/* ネットワーク切替ドロップダウン */}
        <div style={{ position: 'relative' }} ref={dropdownRef}>
          <span
            className={`network-badge ${getNetworkClass(state.activeEnv)}`}
            style={{ cursor: 'pointer', userSelect: 'none' }}
            onClick={() => setShowNetworkDropdown(!showNetworkDropdown)}
            title="クリックでネットワーク切替"
          >
            <span className={`cli-status-dot ${state.connection?.sui_available ? 'connected' : 'disconnected'}`} />
            {switching ? '切替中...' : (state.activeEnv || '未接続')}
            <span style={{ marginLeft: 4, fontSize: '8px', opacity: 0.7 }}>▼</span>
          </span>

          {showNetworkDropdown && (
            <div style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              zIndex: 1000,
              minWidth: 160,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {NETWORKS.map(net => {
                const isActive = state.activeEnv.toLowerCase().includes(net);
                return (
                  <div
                    key={net}
                    onClick={() => handleSwitchNetwork(net)}
                    style={{
                      padding: '8px 14px',
                      fontSize: 'var(--text-sm)',
                      cursor: switching ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: isActive ? 'rgba(77, 166, 255, 0.1)' : 'transparent',
                      color: isActive ? 'var(--color-sui-light)' : 'var(--color-text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = 'rgba(255,255,255,0.05)'); }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = 'transparent'); }}
                  >
                    <span className={`cli-status-dot ${isActive ? 'connected' : ''}`}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
                    {net.charAt(0).toUpperCase() + net.slice(1)}
                    {isActive && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>✓</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ウォレット（エクスプローラーリンク付き） */}
        <div className="wallet-indicator">
          <span>💼</span>
          {state.activeAddress ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="address"
              style={{ textDecoration: 'none', color: 'inherit' }}
              title="Suiscan でアドレスを表示"
            >
              {shortenAddress(state.activeAddress)}
              <span style={{ marginLeft: 4, fontSize: '10px', opacity: 0.6 }}>↗</span>
            </a>
          ) : (
            <span className="address">未選択</span>
          )}
          {/* エイリアス表示 */}
          {state.wallets.find(w => w.is_active)?.alias && (
            <span className="tag">
              {state.wallets.find(w => w.is_active)?.alias}
            </span>
          )}
        </div>
      </div>

      <div className="header-right">
        {/* 残高 */}
        <div className="balance-display">
          💰 {state.balance || '---'}
        </div>

        {/* CLI ステータス */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          <span>Sui</span>
          <span className={`cli-status-dot ${state.connection?.sui_available ? 'connected' : 'disconnected'}`} />
          <span>Walrus</span>
          <span className={`cli-status-dot ${state.connection?.walrus_available ? 'connected' : 'disconnected'}`} />
        </div>

        {/* リフレッシュ */}
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => refreshWallets()}
          title="ウォレット情報を更新"
        >
          🔄
        </button>
      </div>
    </header>
  );
}
