// ==========================================
// ウォレット管理 (Wallet Management) タブ
// ==========================================
import { useState } from 'react';
import { useAppState } from '../../store/app-store';
import * as walletService from '../../services/wallet-service';
import { getPrivateKeyForAddress } from '../../services/sui-sdk/signer-provider';

export function WalletTab() {
  const { state, addLog, addToast, refreshWallets } = useAppState();
  const [loading, setLoading] = useState(false);

  // New Wallet States
  const [newAddress, setNewAddress] = useState<{ address: string; mnemonic: string } | null>(null);
  
  // Import States
  const [importKey, setImportKey] = useState('');

  // Export States
  const [exportedKey, setExportedKey] = useState<{ address: string; key: string } | null>(null);

  const handleCreateWallet = async () => {
    if (!confirm('新しい Sui アドレス（Ed25519）を生成しますか？\n生成されたリカバリフレーズは必ず安全な場所に保管してください。')) return;

    setLoading(true);
    try {
      const result = await walletService.createNewAddress(state.settings.sui_cli_path);
      setNewAddress(result);
      addToast({ type: 'success', title: 'アドレス生成成功', message: '新しいアドレスが生成されました。' });
      addLog('info', 'Wallet', `✅ 新規アドレス生成: ${result.address}`);
      await refreshWallets();
    } catch (e) {
      addToast({ type: 'error', title: '生成失敗', message: String(e) });
      addLog('error', 'Wallet', `❌ アドレス生成失敗: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = async () => {
    if (!importKey.trim()) return;
    
    setLoading(true);
    try {
      const address = await walletService.importPrivateKey(importKey.trim(), state.settings.sui_cli_path);
      addToast({ type: 'success', title: 'インポート成功', message: `アドレス: ${address.slice(0, 10)}...` });
      addLog('info', 'Wallet', `✅ 秘密鍵インポート成功: ${address}`);
      setImportKey('');
      await refreshWallets();
    } catch (e) {
      addToast({ type: 'error', title: 'インポート失敗', message: String(e) });
      addLog('error', 'Wallet', `❌ インポート失敗: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExportKey = async (address: string) => {
    if (!confirm(`警告: アドレス ${address.slice(0,8)}... の秘密鍵を表示しますか？\n秘密鍵が他人に漏れると、そのアドレスの資産はすべて失われます。`)) return;

    try {
      const key = await getPrivateKeyForAddress(address);
      setExportedKey({ address, key });
      addToast({ type: 'info', title: '秘密鍵を抽出しました', message: '画面上の表示を確認してください。' });
    } catch (e) {
      addToast({ type: 'error', title: 'エクスポート失敗', message: String(e) });
    }
  };

  const handleSwitchAddress = async (address: string) => {
    setLoading(true);
    try {
      await walletService.switchActiveAddress(address, state.settings.sui_cli_path);
      addToast({ type: 'success', title: '切替成功', message: 'アクティブアドレスを変更しました。' });
      addLog('info', 'Wallet', `🔄 アクティブアドレス切替: ${address}`);
      await refreshWallets();
    } catch (e) {
      addToast({ type: 'error', title: '切替失敗', message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
      
      {/* 2. 秘密鍵表示エリア (Export時のみ出現) */}
      {exportedKey && (
        <div className="card" style={{ border: '2px solid var(--color-error)', background: 'rgba(255, 107, 107, 0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h3 className="card-title" style={{ color: 'var(--color-error)', margin: 0 }}>🚨 秘密鍵エクスポート設定</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setExportedKey(null)}>✖ 閉じる</button>
          </div>
          <p style={{ fontSize: 'var(--text-xs)', marginBottom: 'var(--space-sm)' }}>
            アドレス: <code className="mono">{exportedKey.address}</code> の秘密鍵（エンコード済み）です。
          </p>
          <div style={{ 
            background: 'var(--color-bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', wordBreak: 'break-all',
            border: '1px solid var(--color-border)', color: 'var(--color-error)', fontWeight: 'bold',
            userSelect: 'all', cursor: 'pointer'
          }}
            onClick={() => { navigator.clipboard.writeText(exportedKey.key); addToast({ type: 'success', title: 'コピーしました', message: '秘密鍵をクリップボードにコピーしたばい。' }); }}
            title="クリックしてコピー"
          >
            {exportedKey.key}
          </div>
          <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 8 }}>
            ※ この文字列を他のウォレット（Sui Wallet, Phantom等）にインポートすることでアカウントを復元できます。
          </p>
        </div>
      )}

      {/* 1. 操作エリア (Create / Import) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
        
        {/* 新規作成 */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 className="card-title">✨ 新規アドレス生成</h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
              Sui CLI を使用して新しい Ed25519 アドレスとリカバリフレーズを生成します。
            </p>
          </div>
          
          {newAddress ? (
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-success)' }}>
              <p style={{ margin: '0 0 8px', fontSize: 'var(--text-xs)', fontWeight: 'bold', color: 'var(--color-success)' }}>⚠️ リカバリフレーズ（絶対に他人に教えないで！）</p>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', wordBreak: 'break-all', marginBottom: 12 }}>
                {newAddress.mnemonic}
              </div>
              <p style={{ margin: '0 0 4px', fontSize: 'var(--text-xs)', opacity: 0.7 }}>生成されたアドレス:</p>
              <div style={{ fontSize: '11px', opacity: 0.9 }}>{newAddress.address}</div>
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', marginTop: 12 }} onClick={() => setNewAddress(null)}>閉じる</button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={handleCreateWallet} disabled={loading}>
              新しいアドレスを生成する
            </button>
          )}
        </div>

        {/* インポート */}
        <div className="card">
          <h3 className="card-title">📥 秘密鍵インポート</h3>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
            既存の 33/32バイト または 64バイト の秘密鍵（Sui形式, Hex, Base64等）をインポートします。
          </p>
          <div className="form-group">
            <input
              type="password"
              className="form-input"
              placeholder="suiprivkey1..."
              value={importKey}
              onChange={e => setImportKey(e.target.value)}
              disabled={loading}
              style={{ fontSize: 'var(--text-xs)' }}
            />
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleImportWallet} disabled={loading || !importKey.trim()}>
            インポート実行
          </button>
        </div>
      </div>

      {/* 2. アドレス一覧 */}
      <div>
        <h3 className="section-title">📋 登録済みアドレス一覧</h3>
        <div className="table-container shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 60 }}>Status</th>
                <th>Alias / アドレス</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {state.wallets.map(w => (
                <tr key={w.address} style={w.is_active ? { background: 'rgba(77, 166, 255, 0.05)' } : {}}>
                  <td>
                    {w.is_active ? (
                      <span className="badge badge-sui" style={{ fontSize: '9px' }}>Active</span>
                    ) : (
                      <span style={{ fontSize: '9px', opacity: 0.3 }}>-</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{w.alias}</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{w.address}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                       <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(w.address); addToast({ type: 'info', title: 'コピー', message: 'アドレスをコピーしました' }); }}>
                        🔗 Copy
                      </button>
                      <button className="btn btn-outline btn-sm" style={{ color: 'var(--color-error)', borderColor: 'var(--color-error)' }} onClick={() => handleExportKey(w.address)} disabled={loading}>
                        🔑 Export
                      </button>
                      {!w.is_active && (
                        <button className="btn btn-outline btn-sm" onClick={() => handleSwitchAddress(w.address)} disabled={loading}>
                          Switch
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
