// ==========================================
// NFT / アセットタブ - SDK経由でNFTを抽出・プレビュー
// ==========================================
import { useState, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import * as sdkService from '../../services/sui-sdk/sui-sdk-service';

interface NftItem {
  objectId: string;
  name: string;
  description: string;
  imageUrl: string;
  type: string;
}

export function NftTab() {
  const { state, addLog } = useAppState();
  const [nfts, setNfts] = useState<NftItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedNft, setSelectedNft] = useState<NftItem | null>(null);
  const [detail, setDetail] = useState<sdkService.SdkObjectDetail | null>(null);

  const fetchNfts = async () => {
    if (!state.activeAddress) return;
    setLoading(true);
    setError(null);
    setNfts([]);
    try {
      addLog('info', 'SDK', 'NFT / アセットを検索中...');
      const res = await sdkService.getOwnedObjects(state.activeAddress, state.activeEnv);
      const nftItems: NftItem[] = [];

      for (const obj of res.objects) {
        // display 情報がある or type名にNFT系キーワードを含むものを抽出
        try {
          const d = await sdkService.getObjectDetail(obj.objectId, state.activeEnv);
          if (d.display && (d.display.name || d.display.image_url)) {
            nftItems.push({
              objectId: d.objectId,
              name: d.display.name || 'Unnamed',
              description: d.display.description || '',
              imageUrl: d.display.image_url || '',
              type: d.type,
            });
          }
        } catch {
          // skip
        }
      }

      setNfts(nftItems);
      addLog('info', 'SDK', `${nftItems.length}件の NFT / アセットを発見しました`);
    } catch (e) {
      setError(String(e));
      addLog('error', 'SDK', String(e));
    } finally {
      setLoading(false);
    }
  };

  const showDetail = async (nft: NftItem) => {
    setSelectedNft(nft);
    try {
      const d = await sdkService.getObjectDetail(nft.objectId, state.activeEnv);
      setDetail(d);
    } catch { /* skip */ }
  };

  const [transferToAddress, setTransferToAddress] = useState('');
  const [transferring, setTransferring] = useState(false);

  const handleTransfer = async () => {
    if (!selectedNft || !transferToAddress) return;
    if (!confirm(`${selectedNft.name} を ${transferToAddress} に送信しますか？`)) return;

    setTransferring(true);
    try {
      addLog('info', 'SDK', 'NFTを送信中...');
      const result = await sdkService.transferObject(
        state.activeAddress,
        transferToAddress,
        selectedNft.objectId,
        state.activeEnv,
        state.settings.sui_cli_path
      );

      if (result.status === 'success') {
        addLog('info', 'SDK', `✅ NFT送信成功: ${result.digest}`);
        alert('送信が完了しました！');
        setSelectedNft(null);
        setDetail(null);
        setTransferToAddress('');
        fetchNfts(); // 再取得
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      addLog('error', 'SDK', `❌ NFT送信失敗: ${e}`);
      alert(`送信エラー: ${e}`);
    } finally {
      setTransferring(false);
    }
  };

  useEffect(() => {
    if (state.activeAddress && state.activeEnv) fetchNfts();
  }, [state.activeAddress, state.activeEnv]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h3 className="section-title" style={{ margin: 0 }}>🎨 NFT / アセット ({nfts.length}件)</h3>
        <button className="btn btn-ghost btn-sm" onClick={fetchNfts} disabled={loading}>
          {loading ? 'スキャン中...' : '🔄 再スキャン'}
        </button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-error)', marginBottom: 'var(--space-lg)' }}>
          <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)' }}>❌ {error}</p>
        </div>
      )}

      {loading && <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 'var(--space-xl)' }}>オブジェクトをスキャン中...</p>}

      {!loading && nfts.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <p style={{ color: 'var(--color-text-muted)' }}>Display メタデータ付きのオブジェクトが見つかりませんでした。</p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-lg)' }}>
        {nfts.map(nft => (
          <div key={nft.objectId} className="card" onClick={() => showDetail(nft)}
            style={{ cursor: 'pointer', padding: 'var(--space-md)', border: selectedNft?.objectId === nft.objectId ? '1px solid var(--color-sui)' : undefined }}>
            {nft.imageUrl && (
              <div style={{ width: '100%', height: 160, borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 'var(--space-sm)', background: 'var(--color-bg-tertiary)' }}>
                <img src={nft.imageUrl} alt={nft.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={e => (e.currentTarget.style.display = 'none')} />
              </div>
            )}
            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{nft.name}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {nft.type.split('::').pop()}
            </div>
          </div>
        ))}
      </div>

      {/* 詳細モーダル */}
      {selectedNft && detail && (
        <div className="modal-overlay" onClick={() => { if (!transferring) { setSelectedNft(null); setDetail(null); setTransferToAddress(''); } }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3 className="modal-title">{selectedNft.name}</h3>
            {selectedNft.imageUrl && (
              <img src={selectedNft.imageUrl} alt={selectedNft.name}
                style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)', background: 'var(--color-bg-tertiary)' }} />
            )}
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-md)' }}>{selectedNft.description}</p>
            {[
              ['Object ID', detail.objectId],
              ['Type', detail.type],
              ['Digest', detail.digest],
            ].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 'var(--space-xs)' }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{label}: </span>
                <span className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}
                  onClick={() => navigator.clipboard.writeText(String(val))}>{val}</span>
              </div>
            ))}

            {/* 送信フォーム */}
            <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <h4 style={{ margin: '0 0 var(--space-sm) 0', fontSize: 'var(--text-sm)' }}>📤 この NFT を送信する</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="宛先の Sui アドレス (0x...)"
                  value={transferToAddress}
                  onChange={e => setTransferToAddress(e.target.value)}
                  disabled={transferring}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={handleTransfer}
                  disabled={transferring || !transferToAddress}
                >
                  {transferring ? '送信中...' : '送信'}
                </button>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginTop: 8 }}>
                ※所有権が完全に移行するため、自己責任で送金してください
              </p>
            </div>

            <div className="modal-actions" style={{ marginTop: 'var(--space-lg)' }}>
              <button className="btn btn-ghost" onClick={() => { setSelectedNft(null); setDetail(null); setTransferToAddress(''); }} disabled={transferring}>閉じる</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
