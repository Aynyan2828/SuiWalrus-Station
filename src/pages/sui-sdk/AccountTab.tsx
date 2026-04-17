// ==========================================
// アカウントタブ - SDK経由でアカウント情報表示 (Merge/Split付き)
// ==========================================
import { useState, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';

export function AccountTab() {
  const { state, addLog, addToast, refreshWallets } = useAppState();
  const [info, setInfo] = useState<sdkService.SdkAccountInfo | null>(null);
  const [gasCoins, setGasCoins] = useState<sdkService.SdkGasCoin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // コイン操作用ステート
  const [selectedCoins, setSelectedCoins] = useState<string[]>([]);
  const [splitAmount, setSplitAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAll = async () => {
    if (!state.activeAddress || !state.activeEnv) {
      setError('アクティブアドレスまたはネットワークが設定されとらんばい。設定ページを確認してね。');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      addLog('info', 'SDK', 'アカウント情報を取得中...');
      const [accountInfo, coins] = await Promise.all([
        sdkService.getAccountInfo(state.activeAddress, state.activeEnv),
        sdkService.getGasCoins(state.activeAddress, state.activeEnv),
      ]);
      setInfo(accountInfo);
      setGasCoins(coins);
      setSelectedCoins([]); // リセット
      addLog('info', 'SDK', `アカウント情報を取得しました (残高: ${accountInfo.balanceSui} SUI, ガスコイン: ${coins.length}件)`);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      addLog('error', 'SDK', msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (state.activeAddress && state.activeEnv) fetchAll();
  }, [state.activeAddress, state.activeEnv]);

  const toggleCoinSelection = (coinId: string) => {
    setSelectedCoins(prev =>
      prev.includes(coinId) ? prev.filter(id => id !== coinId) : [...prev, coinId]
    );
  };

  const handleMergeCoins = async () => {
    if (selectedCoins.length < 2) {
      addToast({ type: 'warning' as any, title: 'エラー', message: '統合には少なくとも2つのコインを選択してください。' });
      return;
    }

    if (!confirm(`${selectedCoins.length} 個のコインを統合しますか？`)) return;

    setActionLoading(true);
    // 最初のコインをプライマリとする
    const [primaryCoinId, ...coinsToMerge] = selectedCoins;

    try {
      addToast({ type: 'info', title: 'Merge 実行中', message: 'コインを統合しています...' });
      const result = await sdkService.requestMergeCoins(
        state.activeAddress,
        primaryCoinId,
        coinsToMerge,
        state.activeEnv,
        state.settings.sui_cli_path
      );

      if (result.status === 'success') {
        addToast({ type: 'success', title: 'Merge 成功！', message: `Digest: ${result.digest}` });
        addLog('info', 'Account', `✅ Merge成功: ${result.digest}`);
        await fetchAll();
        await refreshWallets();
      } else {
        throw new Error(result.error || '不明なエラー');
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Merge 失敗', message: String(e) });
      addLog('error', 'Account', `❌ Merge失敗: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSplitCoin = async () => {
    if (selectedCoins.length !== 1) {
      addToast({ type: 'warning' as any, title: 'エラー', message: '分割するコインを正確に1つ選択してください。' });
      return;
    }

    const amountNum = parseFloat(splitAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast({ type: 'error', title: 'エラー', message: '正しい分割額（SUI）を入力してください。' });
      return;
    }

    if (!confirm(`選択したコインから ${splitAmount} SUI を切り出しますか？`)) return;

    setActionLoading(true);
    const amountInMist = BigInt(Math.floor(amountNum * 1_000_000_000));
    const coinId = selectedCoins[0];

    try {
      addToast({ type: 'info', title: 'Split 実行中', message: 'コインを切り出しています...' });
      const result = await sdkService.requestSplitCoin(
        state.activeAddress,
        coinId,
        amountInMist,
        state.activeEnv,
        state.settings.sui_cli_path
      );

      if (result.status === 'success') {
        addToast({ type: 'success', title: 'Split 成功！', message: `Digest: ${result.digest}` });
        addLog('info', 'Account', `✅ Split成功: ${result.digest}`);
        setSplitAmount('');
        await fetchAll();
        await refreshWallets();
      } else {
        throw new Error(result.error || '不明なエラー');
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Split 失敗', message: String(e) });
      addLog('error', 'Account', `❌ Split失敗: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h3 className="section-title" style={{ margin: 0 }}>👤 アカウント情報</h3>
        <button className="btn btn-ghost btn-sm" onClick={fetchAll} disabled={loading || actionLoading}>
          {loading ? '取得中...' : '🔄 再読み込み'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-error)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>❌ {error}</p>
        </div>
      )}

      {info && (
        <div className="card-grid" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="stat-card">
            <span className="stat-label">ネットワーク</span>
            <span className="stat-value">{info.network}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">SUI 残高</span>
            <span className="stat-value sui">{info.balanceSui} SUI</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">RPC 状態</span>
            <span className="stat-value" style={{ color: info.rpcOk ? 'var(--color-success)' : 'var(--color-error)' }}>
              {info.rpcOk ? `✅ ${info.rpcLatencyMs}ms` : '❌ 切断'}
            </span>
          </div>
        </div>
      )}

      {info && (
        <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
          <h3 className="card-title">📋 アドレス</h3>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
            background: 'var(--color-bg-input)', padding: 'var(--space-md)',
            borderRadius: 'var(--radius-md)', wordBreak: 'break-all',
            cursor: 'pointer', color: 'var(--color-sui-light)'
          }}
            onClick={() => { navigator.clipboard.writeText(info.address); addToast({ type: 'info', title: 'コピーしました', message: 'アドレスをクリップボードにコピーしました' }); }}
            title="クリックでコピー"
          >
            {info.address}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-xs)' }}>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
              MIST: {info.balanceMist}
            </p>
          </div>
        </div>
      )}

      {gasCoins.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
            <h3 className="card-title" style={{ margin: 0 }}>⛽ ガスコイン操作 (0x2::sui::SUI)</h3>
            <span className="badge badge-sui" style={{ fontSize: '10px' }}>{gasCoins.length} 個のコイン</span>
          </div>
          
          {/* コイン操作パネル */}
          <div style={{ background: 'var(--color-bg-secondary)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', display: 'flex', gap: 'var(--space-md)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <button
                className="btn btn-primary"
                onClick={handleMergeCoins}
                disabled={actionLoading || selectedCoins.length < 2}
                style={{ width: '100%' }}
              >
                🔄 選択したコインを統合 (Merge)
              </button>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 4, textAlign: 'center' }}>
                ※ リストの上がプライマリコインになります
              </p>
            </div>
            
            <div style={{ width: 1, background: 'var(--color-border)', alignSelf: 'stretch', margin: '0 8px' }}></div>

            <div style={{ flex: 1, minWidth: 200, display: 'flex', gap: 8, flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  className="form-input"
                  placeholder="分割額 (SUI)"
                  value={splitAmount}
                  onChange={e => setSplitAmount(e.target.value)}
                  disabled={actionLoading || selectedCoins.length !== 1}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-secondary"
                  onClick={handleSplitCoin}
                  disabled={actionLoading || selectedCoins.length !== 1 || !splitAmount}
                >
                  ✂️ 分割 (Split)
                </button>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                ※ 1つのコインを選択して金額を指定
              </p>
            </div>
          </div>

          <div className="table-container" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>
                    <input 
                      type="checkbox" 
                      onChange={e => setSelectedCoins(e.target.checked ? gasCoins.map(c => c.coinObjectId) : [])}
                      checked={selectedCoins.length === gasCoins.length && gasCoins.length > 0}
                    />
                  </th>
                  <th>Coin ID</th>
                  <th>残高 (SUI)</th>
                  <th>Version</th>
                </tr>
              </thead>
              <tbody>
                {gasCoins.map((c, index) => (
                  <tr key={c.coinObjectId} style={selectedCoins.includes(c.coinObjectId) ? { background: 'rgba(77, 166, 255, 0.1)' } : {}}>
                    <td>
                      <input 
                        type="checkbox"
                        checked={selectedCoins.includes(c.coinObjectId)}
                        onChange={() => toggleCoinSelection(c.coinObjectId)}
                        disabled={actionLoading}
                      />
                    </td>
                    <td className="mono" style={{ cursor: 'pointer', color: 'var(--color-sui)' }}
                      onClick={() => { navigator.clipboard.writeText(c.coinObjectId); addToast({ type: 'info', title: 'コピー', message: 'Coin IDをコピーしました' }); }}>
                      {c.coinObjectId.slice(0, 10)}...{c.coinObjectId.slice(-6)}
                      {selectedCoins[0] === c.coinObjectId && (
                        <span className="badge badge-low" style={{ marginLeft: 8, fontSize: '9px' }}>Primary</span>
                      )}
                    </td>
                    <td className="mono">
                      {c.balance}
                    </td>
                    <td className="mono" style={{ color: 'var(--color-text-muted)' }}>{c.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
