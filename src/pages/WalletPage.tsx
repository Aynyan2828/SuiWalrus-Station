// ==========================================
// ウォレット管理ページ
// ==========================================
import { useState } from 'react';
import { useAppState } from '../store/app-store';
import * as walletService from '../services/wallet-service';
import * as settingsService from '../services/settings-service';
import type { WalletMetadata } from '../types';

export function WalletPage() {
  const { state, dispatch, addLog, refreshWallets } = useAppState();
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');

  // ウォレットメタデータを取得（存在しなければデフォルト生成）
  const getMetadata = (address: string): WalletMetadata => {
    const existing = state.walletMetadata.find(m => m.address === address);
    if (existing) return existing;
    return { address, alias: '', label: '', tags: [], is_favorite: false };
  };

  // ウォレット切替
  const handleSwitchWallet = async (addressOrAlias: string) => {
    try {
      addLog('info', 'ウォレット', `切替中: ${addressOrAlias}`);
      await walletService.switchActiveAddress(addressOrAlias, state.settings.sui_cli_path);
      addLog('info', 'ウォレット', `✅ 切替完了: ${addressOrAlias}`);
      await refreshWallets();
    } catch (error) {
      addLog('error', 'ウォレット', `❌ 切替失敗: ${error}`);
    }
  };

  // ラベル保存
  const handleSaveLabel = async (address: string) => {
    const metadata = state.walletMetadata.map(m =>
      m.address === address ? { ...m, label: labelInput } : m
    );
    // 新規の場合は追加
    if (!state.walletMetadata.find(m => m.address === address)) {
      const wallet = state.wallets.find(w => w.address === address);
      metadata.push({
        address,
        alias: wallet?.alias || '',
        label: labelInput,
        tags: [],
        is_favorite: false,
      });
    }
    dispatch({ type: 'SET_WALLET_METADATA', metadata });
    await settingsService.saveWalletMetadata(metadata);
    setEditingLabel(null);
    addLog('info', 'ウォレット', `ラベルを更新: ${address.slice(0, 12)}... → "${labelInput}"`);
  };

  // お気に入りトグル
  const handleToggleFavorite = async (address: string) => {
    let metadata = [...state.walletMetadata];
    const idx = metadata.findIndex(m => m.address === address);
    if (idx >= 0) {
      metadata[idx] = { ...metadata[idx], is_favorite: !metadata[idx].is_favorite };
    } else {
      const wallet = state.wallets.find(w => w.address === address);
      metadata.push({
        address,
        alias: wallet?.alias || '',
        label: '',
        tags: [],
        is_favorite: true,
      });
    }
    dispatch({ type: 'SET_WALLET_METADATA', metadata });
    await settingsService.saveWalletMetadata(metadata);
  };

  // 残高個別取得
  const [balances, setBalances] = useState<Record<string, string>>({});
  const fetchBalance = async (address: string) => {
    try {
      const balance = await walletService.getBalance(address, state.settings.sui_cli_path);
      setBalances(prev => ({ ...prev, [address]: balance }));
    } catch {
      setBalances(prev => ({ ...prev, [address]: 'エラー' }));
    }
  };

  // 全残高一括取得
  const fetchAllBalances = async () => {
    addLog('info', 'ウォレット', '全ウォレットの残高を取得中...');
    for (const wallet of state.wallets) {
      await fetchBalance(wallet.address);
    }
    addLog('info', 'ウォレット', '✅ 残高取得完了');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-xl)' }}>
        <h2 className="page-title" style={{ margin: 0 }}>💼 ウォレット管理</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={fetchAllBalances}>💰 残高一括取得</button>
          <button className="btn btn-primary btn-sm" onClick={refreshWallets}>🔄 更新</button>
        </div>
      </div>

      {state.wallets.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💼</span>
          <p>ウォレットが見つかりませんでした</p>
          <p style={{ fontSize: 'var(--text-sm)', marginTop: 8 }}>
            Sui CLIの設定を確認してください
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>★</th>
                  <th>エイリアス</th>
                  <th>アドレス</th>
                  <th>ラベル</th>
                  <th>残高</th>
                  <th>状態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {state.wallets.map((wallet) => {
                  const meta = getMetadata(wallet.address);
                  return (
                    <tr
                      key={wallet.address}
                      className={wallet.is_active ? 'active-row wallet-row-active' : ''}
                    >
                      <td>
                        <span
                          className="favorite-star"
                          onClick={() => handleToggleFavorite(wallet.address)}
                        >
                          {meta.is_favorite ? '⭐' : '☆'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {wallet.alias}
                      </td>
                      <td className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {wallet.address}
                      </td>
                      <td>
                        {editingLabel === wallet.address ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input
                              className="form-input"
                              value={labelInput}
                              onChange={(e) => setLabelInput(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveLabel(wallet.address)}
                              style={{ padding: '2px 6px', fontSize: 'var(--text-xs)', width: 100 }}
                              autoFocus
                            />
                            <button className="btn btn-ghost btn-sm" onClick={() => handleSaveLabel(wallet.address)}>✓</button>
                          </div>
                        ) : (
                          <span
                            className="tag"
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              setEditingLabel(wallet.address);
                              setLabelInput(meta.label);
                            }}
                          >
                            {meta.label || 'ラベル追加'}
                          </span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize: 'var(--text-xs)' }}>
                        {balances[wallet.address] || '---'}
                      </td>
                      <td>
                        {wallet.is_active ? (
                          <span className="badge badge-sui">✅ アクティブ</span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--color-bg-tertiary)', color: 'var(--color-text-muted)' }}>
                            非アクティブ
                          </span>
                        )}
                      </td>
                      <td>
                        {!wallet.is_active && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSwitchWallet(wallet.alias || wallet.address)}
                          >
                            切替
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
