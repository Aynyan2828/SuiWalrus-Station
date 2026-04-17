// ==========================================
// Move Call / Advanced タブ
// ==========================================
import { useState } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';

export function MoveCallTab() {
  const { state, addLog } = useAppState();
  const [packageId, setPackageId] = useState('');
  const [module, setModule] = useState('');
  const [fn, setFn] = useState('');
  const [typeArgs, setTypeArgs] = useState('');
  const [args, setArgs] = useState('');
  const [gasBudget, setGasBudget] = useState('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<sdkService.SdkTxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const execute = async (dryRun: boolean) => {
    setError(null);
    setResult(null);
    if (!packageId.startsWith('0x')) { setError('Package ID は 0x から始まる必要があるばい。'); return; }
    if (!module.trim()) { setError('Module 名を入力してね。'); return; }
    if (!fn.trim()) { setError('Function 名を入力してね。'); return; }

    setExecuting(true);
    try {
      const label = dryRun ? 'Dry Run' : 'Execute';
      addLog('info', 'SDK', `Move Call ${label}: ${packageId.slice(0, 10)}::${module}::${fn}`);

      const res = await sdkService.executeMoveCall(
        state.activeAddress,
        {
          packageId: packageId.trim(),
          module: module.trim(),
          fn: fn.trim(),
          typeArgs: typeArgs.split(',').map(t => t.trim()).filter(Boolean),
          args: args.split(',').map(a => a.trim()).filter(Boolean),
          gasBudget: gasBudget ? parseInt(gasBudget) : undefined,
        },
        state.activeEnv,
        dryRun,
      );

      setResult(res);
      addLog(res.status === 'success' ? 'info' : 'error', 'SDK',
        `${label}: ${res.status === 'success' ? '✅ 成功' : '❌ 失敗'} ${res.digest}`);
    } catch (e) {
      setError(String(e));
      addLog('error', 'SDK', String(e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 className="card-title">⚙️ Move Call</h3>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-lg)' }}>
          任意の Move 関数を呼び出せるばい。まずは Dry Run で安全に確認してから実行することをお勧めするけん。
        </p>

        <div className="form-group">
          <label className="form-label">Package ID <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input className="form-input" placeholder="0x..." value={packageId}
            onChange={e => setPackageId(e.target.value)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div className="form-group">
            <label className="form-label">Module <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input className="form-input" placeholder="module_name" value={module}
              onChange={e => setModule(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Function <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input className="form-input" placeholder="function_name" value={fn}
              onChange={e => setFn(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Type Arguments <span style={{ color: 'var(--color-text-muted)' }}>(カンマ区切り)</span></label>
          <input className="form-input" placeholder="0x2::sui::SUI, 0x2::coin::Coin" value={typeArgs}
            onChange={e => setTypeArgs(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Arguments <span style={{ color: 'var(--color-text-muted)' }}>(カンマ区切り)</span></label>
          <input className="form-input" placeholder="0xabc123, 1000, true" value={args}
            onChange={e => setArgs(e.target.value)} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            0x... → オブジェクト参照 / 数値 → u64 / true|false → bool / その他 → 文字列
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Gas Budget <span style={{ color: 'var(--color-text-muted)' }}>(任意、MIST単位)</span></label>
          <input className="form-input" type="number" placeholder="50000000" value={gasBudget}
            onChange={e => setGasBudget(e.target.value)} />
        </div>

        {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>❌ {error}</p>}

        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button className="btn btn-ghost" onClick={() => execute(true)} disabled={executing}>
            {executing ? '実行中...' : '🔍 Dry Run'}
          </button>
          <button className="btn btn-primary" onClick={() => execute(false)} disabled={executing}>
            {executing ? '実行中...' : '▶ Execute'}
          </button>
        </div>
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="card" style={{ borderColor: result.status === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
          <h3 className="card-title">{result.status === 'success' ? '✅ 成功' : '❌ 失敗'}</h3>
          <div style={{ marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Digest: </span>
            <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-sui)', cursor: 'pointer' }}
              onClick={() => { navigator.clipboard.writeText(result.digest); addLog('info', 'SDK', 'Digestをコピーしました'); }}>
              {result.digest}
            </span>
          </div>
          {result.error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>Error: {result.error}</p>}
          {result.gasUsed && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Gas: {result.gasUsed}</p>}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)' }} onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? '閉じる' : 'Raw JSON'}
          </button>
          {showRaw && (
            <pre style={{ marginTop: 'var(--space-sm)', background: 'var(--color-bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', maxHeight: 400, overflowY: 'auto', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {result.rawJson}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
