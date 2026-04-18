import { useState, useEffect } from 'react';
import { useAppState } from '../../store/app-store';
import { TradeportService, TradeportCollection, TradeportNft } from '../../services/TradeportService';
import { TradeportTradingService } from '../../services/tradeport/TradeportTradingService';

export function TradeportMarketTab() {
  const { state, addToast } = useAppState();
  const [query, setQuery] = useState('');
  const [trending, setTrending] = useState<TradeportCollection[]>([]);
  const [results, setResults] = useState<TradeportCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNft, setSelectedNft] = useState<TradeportNft | null>(null);
  const [isBuying, setIsBuying] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<'market' | 'portfolio'>('market');
  const [portfolioAddress, setPortfolioAddress] = useState('');
  const [portfolioResults, setPortfolioResults] = useState<TradeportNft[]>([]);

  const [selectedCollection, setSelectedCollection] = useState<TradeportCollection | null>(null);
  const [collectionNfts, setCollectionNfts] = useState<TradeportNft[]>([]);
  const [sortOrder, setSortOrder] = useState<'lowest' | 'highest' | 'newest'>('lowest');

  // 初回ロード時にトレンド取得
  useEffect(() => {
    fetchTrending();
    // 初期アドレスをセット
    if (state.activeAddress) {
      setPortfolioAddress(state.activeAddress);
    }
  }, [state.activeAddress]);

  // ソート順が変わったら再取得
  useEffect(() => {
    if (selectedCollection) {
      handleCollectionClick(selectedCollection, sortOrder);
    }
  }, [sortOrder]);

  const fetchTrending = async () => {
    try {
      setLoading(true);
      const data = await TradeportService.getTrendingCollections();
      setTrending(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setHasSearched(false);
    setSelectedCollection(null);
    try {
      const data = await TradeportService.searchCollections(query);
      setResults(data);
      setHasSearched(true);
      setActiveTab('market');
    } catch (e) {
      console.error('[TradeportMarketTab] Search Error:', e);
      addToast({ type: 'error', title: '検索失敗', message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleCollectionClick = async (collection: TradeportCollection, order = sortOrder) => {
    setLoading(true);
    setSelectedCollection(collection);
    try {
      const nfts = await TradeportService.getCollectionNfts(collection.slug, order);
      setCollectionNfts(nfts);
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'エラー', message: 'NFTの取得に失敗したばい。' });
    } finally {
      setLoading(false);
    }
  };

  const handlePortfolioSearch = async () => {
    const addr = portfolioAddress.trim() || state.activeAddress;
    if (!addr) {
      addToast({ type: 'error', title: 'エラー', message: 'アドレスを入力してください。' });
      return;
    }
    setLoading(true);
    try {
      const data = await TradeportService.getWalletNftHoldings(addr);
      setPortfolioResults(data);
      setActiveTab('portfolio');
    } catch (e) {
      console.error('[TradeportMarketTab] Portfolio Error:', e);
      addToast({ type: 'error', title: '検索失敗', message: String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleShowNftDetail = async (nft: TradeportNft) => {
    setLoading(true);
    try {
      const detail = await TradeportService.getNftDetail(nft.id);
      setSelectedNft(detail || nft);
    } catch (e) {
      console.error(e);
      setSelectedNft(nft);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (listing: any) => {
    if (!state.activeAddress) {
      addToast({ type: 'error', title: 'エラー', message: 'ウォレットを接続してください。' });
      return;
    }
    if (!confirm(`このNFTを ${listing.price} で購入しますか？`)) return;

    setIsBuying(true);
    try {
      const result = await TradeportTradingService.buyNftListing(
        listing.id,
        state.activeAddress,
        state.activeEnv as any
      );
      
      if (result.status === 'success') {
        addToast({ type: 'success', title: '購入成功！', message: `Digest: ${result.digest}` });
        setSelectedNft(null); // モーダルを閉じる
      } else {
        addToast({ type: 'error', title: '購入失敗', message: result.error });
      }
    } catch (e) {
      addToast({ type: 'error', title: '例外発生', message: String(e) });
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="tradeport-market">
      {/* タブ切り替え */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-lg)' }}>
        <button 
          className={`btn ${activeTab === 'market' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('market')}
        >
          🏰 マーケット探検
        </button>
        <button 
          className={`btn ${activeTab === 'portfolio' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => {
            setActiveTab('portfolio');
            if (portfolioResults.length === 0 && (portfolioAddress || state.activeAddress)) {
              handlePortfolioSearch();
            }
          }}
        >
          🎒 ポートフォリオ検索
        </button>
      </div>

      {/* 検索バー (タブに応じて表示) */}
      <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: '16px' }}>
        {activeTab === 'market' ? (
          <div style={{ display: 'flex', gap: 12 }}>
            <input 
              className="form-input" 
              placeholder="コレクションを検索 (例: Sui8192, Fuddies...)" 
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleSearch} disabled={loading}>
              {loading ? '検索中...' : '🔍 検索'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <input 
              className="form-input" 
              placeholder="ウォレットアドレスを入力..." 
              value={portfolioAddress}
              onChange={e => setPortfolioAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handlePortfolioSearch()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handlePortfolioSearch} disabled={loading}>
              {loading ? '検索中...' : '👤 表示'}
            </button>
          </div>
        )}
      </div>

      {loading && results.length === 0 && portfolioResults.length === 0 && (
        <div style={{ textAlign: 'center', padding: 'var(--space-xl)' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: 16, color: 'var(--color-text-muted)' }}>探索中ばい...</p>
        </div>
      )}

      {/* マーケット表示 */}
      {activeTab === 'market' && (
        <>
          {selectedCollection ? (
            <div style={{ marginBottom: 'var(--space-xl)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button className="btn btn-ghost" onClick={() => setSelectedCollection(null)} style={{ padding: '8px 16px' }}>
                     ← 戻る
                  </button>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800 }}>
                    🖼️ <span style={{ color: 'var(--color-walrus)' }}>{selectedCollection.name}</span>
                  </h3>
                </div>

                {/* ソートボタン */}
                <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12 }}>
                   <button 
                     className={`btn ${sortOrder === 'lowest' ? 'btn-primary' : 'btn-ghost'}`} 
                     style={{ padding: '6px 12px', fontSize: '11px' }}
                     onClick={() => setSortOrder('lowest')}
                   >
                     💎 安い順
                   </button>
                   <button 
                     className={`btn ${sortOrder === 'highest' ? 'btn-primary' : 'btn-ghost'}`} 
                     style={{ padding: '6px 12px', fontSize: '11px' }}
                     onClick={() => setSortOrder('highest')}
                   >
                     🚀 高い順
                   </button>
                   <button 
                     className={`btn ${sortOrder === 'newest' ? 'btn-primary' : 'btn-ghost'}`} 
                     style={{ padding: '6px 12px', fontSize: '11px' }}
                     onClick={() => setSortOrder('newest')}
                   >
                     ✨ 新着/Rank順
                   </button>
                </div>
              </div>

              {collectionNfts.length > 0 ? (
                <div className="template-grid">
                  {collectionNfts.map(nft => (
                    <div key={nft.id} onClick={() => handleShowNftDetail(nft)}>
                      <NftCard nft={nft} />
                    </div>
                  ))}
                </div>
              ) : !loading && (
                <div style={{ textAlign: 'center', padding: '60px', background: 'rgba(255,255,255,0.02)', borderRadius: 24, border: '1px dashed var(--color-border)' }}>
                   <p style={{ color: 'var(--color-text-muted)' }}>NFTが1つも見つからんやったばい。</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {hasSearched && (
                <div style={{ marginBottom: 'var(--space-xl)' }}>
                  <h3 className="section-title">🔎 "{query}" の検索結果</h3>
                  {results.length > 0 ? (
                    <div className="template-grid">
                      {results.map(c => (
                        <div key={c.id} onClick={() => handleCollectionClick(c)}>
                          <CollectionCard collection={c} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
                       <p style={{ color: 'var(--color-text-muted)' }}>一致するコレクションは見つからんやったばい。</p>
                    </div>
                  )}
                </div>
              )}

              {!hasSearched && (
                <div>
                  <h3 className="section-title">🔥 トレンドコレクション</h3>
                  <div className="template-grid">
                    {trending.map(c => (
                      <div key={c.id} onClick={() => handleCollectionClick(c)}>
                        <CollectionCard collection={c} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ポートフォリオ表示 */}
      {activeTab === 'portfolio' && (
        <div>
          <h3 className="section-title">🎒 {portfolioAddress === state.activeAddress ? 'マイ・NFT' : '指定アドレスの保有NFT'}</h3>
          {portfolioResults.length > 0 ? (
            <div className="template-grid">
              {portfolioResults.map(nft => (
                <div key={nft.id} onClick={() => handleShowNftDetail(nft)}>
                  <NftCard nft={nft} />
                </div>
              ))}
            </div>
          ) : !loading && (
            <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: 12 }}>
               <p style={{ color: 'var(--color-text-muted)' }}>NFTが見つからんやったばい。</p>
            </div>
          )}
        </div>
      )}

      {/* 詳細モーダル (プレミアム・リッチ版) */}
      {selectedNft && (
        <div className="modal-overlay" onClick={() => setSelectedNft(null)}>
          <div className="modal premium-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600, padding: 0, overflow: 'hidden' }}>
             <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) 1.2fr', height: '100%' }}>
                <div style={{ padding: 24, borderRight: '1px solid var(--color-border)', background: 'rgba(0,0,0,0.2)' }}>
                   <div style={{ width: '100%', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--shadow-lg)', marginBottom: 16 }}>
                      <img src={selectedNft.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={selectedNft.name} />
                   </div>
                   <div className="price-badge" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '1.2rem' }}>
                      {selectedNft.listings && selectedNft.listings.length > 0 
                        ? `${selectedNft.listings[0].price} SUI` 
                        : 'NOT FOR SALE'}
                   </div>
                </div>

                <div style={{ padding: 32, display: 'flex', flexDirection: 'column' }}>
                   <div style={{ flex: 1 }}>
                      <h3 className="modal-title" style={{ marginBottom: 4, fontSize: '1.5rem' }}>{selectedNft.name}</h3>
                      <div style={{ fontSize: '14px', color: 'var(--color-sui)', marginBottom: 20, fontWeight: 600 }}>
                        {selectedNft.collectionName}
                      </div>
                      
                      {selectedNft.ranking && (
                        <div style={{ marginBottom: 20 }}>
                           <span style={{ padding: '4px 12px', background: 'rgba(77,166,255,0.1)', border: '1px solid var(--color-sui)', borderRadius: 20, color: 'var(--color-sui)', fontSize: '12px', fontWeight: 800 }}>
                             🏆 RANK #{selectedNft.ranking}
                           </span>
                        </div>
                      )}

                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: 20 }}>
                        OWNER: <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>{selectedNft.owner ? `${selectedNft.owner.substring(0, 14)}...` : 'Unknown'}</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                         {selectedNft.attributes && Array.isArray(selectedNft.attributes) && selectedNft.attributes.map((a: any, i: number) => (
                           <div key={i} className="trait-tag">
                              <div style={{ color: 'var(--color-text-muted)', marginBottom: 2 }}>{a.trait_type || a.traitType}</div>
                              <div style={{ fontWeight: 800, color: 'white' }}>{a.value}</div>
                           </div>
                         ))}
                      </div>
                   </div>
                   
                   <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
                      {selectedNft.listings && selectedNft.listings.length > 0 ? (
                        <button className="btn btn-success" onClick={() => handleBuy(selectedNft.listings![0])} disabled={isBuying} style={{ flex: 1, height: 50, fontSize: '1rem' }}>
                           {isBuying ? '実行中...' : '🛒 今すぐ購入'}
                        </button>
                      ) : (
                        <button className="btn" disabled style={{ flex: 1, background: 'rgba(255,255,255,0.05)', color: 'var(--color-text-muted)', cursor: 'not-allowed' }}>
                           出品待ち
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={() => setSelectedNft(null)} style={{ padding: '0 20px' }}>
                        閉じる
                      </button>
                   </div>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionCard({ collection }: { collection: TradeportCollection }) {
  return (
    <div className="template-card">
      <div className="template-image-container">
        <img src={collection.imageUrl} alt={collection.name} loading="lazy" />
      </div>
      <div className="template-name">
        {collection.verified && <span style={{ marginRight: 4 }}>✅</span>}
        {collection.name}
      </div>
      <div className="template-desc">
        {collection.slug}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <div className="price-badge" style={{ fontSize: '11px', padding: '2px 8px' }}>
          Floor: {collection.floorPrice || 'N/A'} SUI
        </div>
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
          Vol: {collection.volume?.toLocaleString() || '0'}
        </div>
      </div>
    </div>
  );
}

function NftCard({ nft }: { nft: TradeportNft }) {
  return (
    <div className="template-card">
      <div className="template-image-container">
        <img src={nft.imageUrl} alt={nft.name} loading="lazy" />
      </div>
      <div className="template-name" style={{ fontSize: '13px' }}>
        {nft.name}
      </div>
      <div className="template-desc" style={{ marginBottom: 4 }}>
        {nft.collectionName}
      </div>
      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {nft.listings && nft.listings.length > 0 ? (
          <div className="price-badge" style={{ fontSize: '10px', padding: '2px 6px' }}>
             {nft.listings[0].price} SUI
          </div>
        ) : nft.ranking ? (
          <div style={{ fontSize: '10px', color: 'var(--color-sui)', fontWeight: 800 }}>
             🏆 #{nft.ranking}
          </div>
        ) : <div />}
        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
          Detail →
        </div>
      </div>
    </div>
  );
}
