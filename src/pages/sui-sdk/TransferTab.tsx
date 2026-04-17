// ==========================================
// 送信タブ - SUI送信 & オブジェクト転送
// ==========================================
import { useState } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';

export function TransferTab() {
  const { state, addLog } = useAppState();
  const [mode, setMode] = useState<'sui' | 'object'>('sui');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [objectId, setObjectId] = useState('');
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<sdkService.SdkTxResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const handleSubmit = () => {
    setError(null);
    if (!toAddress.startsWith('0x') || toAddress.length < 10) {
      setError('宛先アドレスが正しくないばい。0x から始まる完全なアドレスを入力してね。');
      return;
    }
    if (mode === 'sui') {
      const num = parseFloat(amount);
      if (isNaN(num) || num <= 0) {
        setError('送信金額を正しく入力してね。');
        return;
      }
    }
    if (mode === 'object' && (!objectId.startsWith('0x') || objectId.length < 10)) {
      setError('Object ID が正しくないばい。');
      return;
    }
    setShowConfirm(true);
  };

  const executeTransfer = async () => {
    setShowConfirm(false);
    setExecuting(true);
    setResult(null);
    setError(null);
    try {
      let res: sdkService.SdkTxResult;
      if (mode === 'sui') {
        addLog('info', 'SDK', `SUI 送信中: ${amount} SUI → ${toAddress.slice(0, 10)}...`);
        res = await sdkService.transferSui(state.activeAddress, toAddress, parseFloat(amount), state.activeEnv);
      } else {
        addLog('info', 'SDK', `オブジェクト転送中: ${objectId.slice(0, 10)}... → ${toAddress.slice(0, 10)}...`);
        res = await sdkService.transferObject(state.activeAddress, toAddress, objectId, state.activeEnv);
      }
      setResult(res);
      if (res.status === 'success') {
        addLog('info', 'SDK', `✅ 送信成功！ Digest: ${res.digest}`);
      } else {
        addLog('error', 'SDK', `❌ 送信失敗: ${res.error || res.status}`);
      }
    } catch (e) {
      setError(String(e));
      addLog('error', 'SDK', String(e));
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div>
      {/* モード切替 */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-lg)' }}>
        <button className={`btn ${mode === 'sui' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setMode('sui')}>💰 SUI 送信</button>
        <button className={`btn ${mode === 'object' ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setMode('object')}>📦 オブジェクト転送</button>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 className="card-title">{mode === 'sui' ? '💰 SUI 送信' : '📦 オブジェクト転送'}</h3>

        <div className="form-group">
          <label className="form-label">送信元 <span style={{ color: 'var(--color-text-muted)' }}>(アクティブアドレス)</span></label>
          <input className="form-input" value={state.activeAddress || '未設定'} disabled />
        </div>

        <div className="form-group">
          <label className="form-label">宛先アドレス <span style={{ color: 'var(--color-error)' }}>*</span></label>
          <input className="form-input" placeholder="0x..." value={toAddress}
            onChange={e => setToAddress(e.target.value)} />
        </div>

        {mode === 'sui' ? (
          <div className="form-group">
            <label className="form-label">金額 (SUI) <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input className="form-input" type="number" step="0.001" min="0" placeholder="0.1"
              value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        ) : (
          <div className="form-group">
            <label className="form-label">Object ID <span style={{ color: 'var(--color-error)' }}>*</span></label>
            <input className="form-input" placeholder="0x..." value={objectId}
              onChange={e => setObjectId(e.target.value)} />
          </div>
        )}

        {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>❌ {error}</p>}

        <button className="btn btn-primary" onClick={handleSubmit} disabled={executing}>
          {executing ? '送信中...' : '📤 送信'}
        </button>
      </div>

      {/* 結果表示 */}
      {result && (
        <div className="card" style={{ borderColor: result.status === 'success' ? 'var(--color-success)' : 'var(--color-error)' }}>
          <h3 className="card-title">{result.status === 'success' ? '✅ 送信成功' : '❌ 送信失敗'}</h3>
          <div style={{ marginBottom: 'var(--space-sm)' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Digest: </span>
            <span className="mono" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-sui)', cursor: 'pointer' }}
              onClick={() => { navigator.clipboard.writeText(result.digest); addLog('info', 'SDK', 'Digestをコピーしました'); }}>
              {result.digest}
            </span>
          </div>
          {result.gasUsed && <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Gas: {result.gasUsed}</p>}
          {result.error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>{result.error}</p>}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--space-sm)' }} onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? '閉じる' : 'Raw JSON'}
          </button>
          {showRaw && (
            <pre style={{ marginTop: 'var(--space-sm)', background: 'var(--color-bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-xs)', maxHeight: 300, overflowY: 'auto', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {result.rawJson}
            </pre>
          )}
        </div>
      )}

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">⚠️ 送信確認</h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>
              以下の内容で送信を実行しますか？
            </p>
            <div style={{ background: 'var(--color-bg-input)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginBottom: 4 }}>宛先</div>
              <div className="mono" style={{ fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>{toAddress}</div>
              {mode === 'sui' && (
                <>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)', marginBottom: 4 }}>金額</div>
                  <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-sui-light)' }}>{amount} SUI</div>
                </>
              )}
              {mode === 'object' && (
                <>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-sm)', marginBottom: 4 }}>Object ID</div>
                  <div className="mono" style={{ fontSize: 'var(--text-sm)', wordBreak: 'break-all' }}>{objectId}</div>
                </>
              )}
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>キャンセル</button>
              <button className="btn btn-danger" onClick={executeTransfer}>送信する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
