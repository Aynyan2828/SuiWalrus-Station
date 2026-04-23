// ==========================================
// ステーキング (SUI Staking) タブ
// ==========================================
import { useState, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';
import { getAddressExplorerUrl } from '../../utils/explorer-utils';
import { NaviService } from '../../services/navi/NaviService';

export function StakingTab() {
  const { state, addLog, refreshWallets, addToast } = useAppState();

  const [stakes, setStakes] = useState<any[]>([]);
  const [validators, setValidators] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [naviRewards, setNaviRewards] = useState<{ symbol: string, amount: number }[]>([]);
  const [rewardsLoading, setRewardsLoading] = useState(false);

  // Stake Form
  const [selectedValidator, setSelectedValidator] = useState('');
  const [stakeAmount, setStakeAmount] = useState('');

  const fetchStakes = async () => {
    if (!state.activeAddress || !state.activeEnv) return;
    setLoading(true);
    try {
      const [stakesData, validatorsData] = await Promise.all([
        sdkService.getStakes(state.activeAddress, state.activeEnv),
        sdkService.getValidators(state.activeEnv),
      ]);
      setStakes(stakesData);
      setValidators(validatorsData);
    } catch (e) {
      addLog('error', 'Staking', `情報取得エラー: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchNaviRewards = async () => {
    if (!state.activeAddress || !state.activeEnv) return;
    setRewardsLoading(true);
    try {
      const data = await NaviService.getClaimableRewards(state.activeAddress, state.activeEnv);
      setNaviRewards(data);
    } catch (e) {
      console.error('Navi rewards fetch failed:', e);
    } finally {
      setRewardsLoading(false);
    }
  };

  useEffect(() => {
    fetchStakes();
    fetchNaviRewards();
  }, [state.activeAddress, state.activeEnv]);

  const handleAddStake = async () => {
    if (!selectedValidator || !stakeAmount) return;
    const amountNum = parseFloat(stakeAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      addToast({ type: 'error', title: 'エラー', message: '正しい金額を入力してください。' });
      return;
    }

    // 最小ステーキング額は 1 SUI
    if (amountNum < 1) {
      addToast({ type: 'error', title: 'エラー', message: 'ステーキングの最小額は 1 SUI です。' });
      return;
    }

    const amountInMist = BigInt(Math.floor(amountNum * 1_000_000_000));
    setActionLoading(true);

    try {
      addToast({ type: 'info', title: 'Stake 実行中', message: `バリデーターに ${stakeAmount} SUI を委任しています...` });
      const result = await sdkService.requestAddStake(
        state.activeAddress,
        selectedValidator,
        amountInMist,
        state.activeEnv,
        state.settings.sui_cli_path
      );

      if (result.status === 'success') {
        addToast({ type: 'success', title: 'Stake 成功！', message: `Digest: ${result.digest}` });
        addLog('info', 'Staking', `✅ Stake成功: ${result.digest}`);
        setStakeAmount('');
        await fetchStakes();
        await refreshWallets();
      } else {
        throw new Error(result.error || '不明なエラー');
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Stake 失敗', message: String(e) });
      addLog('error', 'Staking', `❌ Stake失敗: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawStake = async (stakedSuiId: string) => {
    if (!confirm('本当にアンステーク（解除）しますか？')) return;
    setActionLoading(true);

    try {
      addToast({ type: 'info', title: 'Unstake 実行中', message: 'ステーキング解除をリクエストしています...' });
      const result = await sdkService.requestWithdrawStake(
        state.activeAddress,
        stakedSuiId,
        state.activeEnv,
        state.settings.sui_cli_path
      );

      if (result.status === 'success') {
        addToast({ type: 'success', title: 'Unstake 成功！', message: `Digest: ${result.digest}` });
        addLog('info', 'Staking', `✅ Unstake成功: ${result.digest}`);
        await fetchStakes();
        await refreshWallets();
      } else {
        throw new Error(result.error || '不明なエラー');
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Unstake 失敗', message: String(e) });
      addLog('error', 'Staking', `❌ Unstake失敗: ${e}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAutoCompound = async () => {
    if (!state.activeAddress || !state.activeEnv) return;
    setActionLoading(true);
    try {
      addToast({ type: 'info', title: 'Auto-compound 実行中', message: 'Navi 報酬の回収と再投資をリクエストしています...' });
      const result = await NaviService.autoCompound(
        state.activeAddress,
        state.activeEnv,
        state.settings.sui_cli_path
      );
      
      if (result.status === 'success') {
        addToast({ type: 'success', title: '収穫完了！', message: `Digest: ${result.digest}` });
        addLog('info', 'DeFi', `✅ Auto-compound成功: ${result.digest}`);
        await fetchNaviRewards();
        await refreshWallets();
      }
    } catch (e) {
      addToast({ type: 'error', title: 'Auto-compound 失敗', message: String(e) });
    } finally {
      setActionLoading(false);
    }
  };

  // 表示用に Validator を名前で引けるようにする
  const getValidatorName = (address: string) => {
    const v = validators.find((val: any) => val.suiAddress === address);
    return v ? v.name : `${address.slice(0, 10)}...`;
  };

  const formatSui = (mist: string | number | bigint) => {
    return (Number(mist) / 1_000_000_000).toFixed(4) + ' SUI';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h3 className="section-title" style={{ margin: 0 }}>🥩 Staking</h3>
        <button className="btn btn-ghost btn-sm" onClick={fetchStakes} disabled={loading || actionLoading}>
          {loading ? '読み込み中...' : '🔄 更新'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-lg)' }}>
        {/* 新規ステーキング用フォーム */}
        <div className="card">
          <h3 className="card-title">✨ 新規 Stake</h3>
          <div className="form-group">
            <label className="form-label">バリデーターを選択</label>
            <select
              className="form-input"
              value={selectedValidator}
              onChange={e => setSelectedValidator(e.target.value)}
              disabled={actionLoading}
            >
              <option value="">-- 選択してください --</option>
              {validators.map((v: any) => (
                <option key={v.suiAddress} value={v.suiAddress}>
                  {v.name} (APY: {(Number(v.apy || 0) * 100).toFixed(2)}%)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">ステーキング額 (SUI) - 最小 1 SUI</label>
            <input
              type="number"
              className="form-input"
              placeholder="例: 10"
              value={stakeAmount}
              onChange={e => setStakeAmount(e.target.value)}
              disabled={actionLoading}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={handleAddStake}
            disabled={actionLoading || !selectedValidator || !stakeAmount}
          >
            {actionLoading ? '実行中...' : 'Stake 実行'}
          </button>
        </div>

        {/* ネットワーク情報・サマリー */}
        <div className="card">
          <h3 className="card-title">ℹ️ ステーキング情報</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--text-sm)' }}>
            <li style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>総委任数:</span>
              <span>{stakes.length} 件</span>
            </li>
            <li style={{ padding: '8px 0', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>利用可能SUI:</span>
              <span style={{ color: 'var(--color-sui)', fontWeight: 'bold' }}>{state.balance}</span>
            </li>
          </ul>
        </div>

        {/* ⚡ DeFi Yield セクション */}
        <div className="card" style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-sui-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-md)' }}>
            <div>
              <h3 className="card-title" style={{ color: 'var(--color-sui)', marginBottom: 4 }}>⚡ DeFi Yield Optimization</h3>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Navi Protocol 連携</p>
            </div>
            <div className={`badge ${rewardsLoading ? 'badge-medium' : 'badge-low'}`}>
              {rewardsLoading ? '確認中...' : 'Active'}
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', display: 'block', marginBottom: 8 }}>未回収の報酬:</span>
            {naviRewards.map(r => (
              <div key={r.symbol} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{r.symbol}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)', fontWeight: 'bold' }}>+{r.amount.toFixed(4)}</span>
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', background: 'linear-gradient(135deg, #00f2ff, #00d4ff)', border: 'none', boxShadow: '0 4px 15px rgba(0, 242, 255, 0.3)' }}
            onClick={handleAutoCompound}
            disabled={actionLoading}
          >
            {actionLoading ? '実行中...' : '⚡ Auto-compound 実行'}
          </button>
          <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center' }}>
            ※報酬を Claim し、自動で SUI として再投資します
          </p>
        </div>
      </div>

      <h3 className="section-title">📊 現在のステーキングリスト</h3>
      
      {stakes.length === 0 && !loading ? (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>現在ステーキングしている SUI はありません。</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>バリデーター</th>
                <th>ステータス</th>
                <th>元本 (Principal)</th>
                <th>報酬 (Earned)</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {stakes.map((validatorStakes: any) =>
                validatorStakes.stakes.map((stake: any) => (
                  <tr key={stake.stakedSuiId}>
                    <td>
                      <a
                        href={getAddressExplorerUrl(validatorStakes.validatorAddress, state.activeEnv)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {getValidatorName(validatorStakes.validatorAddress)}
                        <span style={{ marginLeft: 4, fontSize: '10px' }}>↗</span>
                      </a>
                    </td>
                    <td>
                      <span className={`badge ${stake.status === 'Active' ? 'badge-low' : 'badge-medium'}`}>
                        {stake.status}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: 'var(--text-sm)' }}>
                      {formatSui(stake.principal)}
                    </td>
                    <td className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                      +{formatSui(stake.estimatedReward || 0)}
                    </td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleWithdrawStake(stake.stakedSuiId)}
                        disabled={actionLoading}
                      >
                        Unstake
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
