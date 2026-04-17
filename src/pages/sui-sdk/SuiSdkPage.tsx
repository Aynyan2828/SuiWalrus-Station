// ==========================================
// Sui SDK ページ - メインコンテナ（タブルーター）
// 既存 SuiPage とは完全に独立。
// ==========================================
import { useState } from 'react';
import { AccountTab } from './AccountTab';
import { WalletTab } from './WalletTab';
import { ObjectsTab } from './ObjectsTab';
import { NftTab } from './NftTab';
import { TransferTab } from './TransferTab';
import { MoveCallTab } from './MoveCallTab';
import { TransactionHistoryTab } from './TransactionHistoryTab';
import { StakingTab } from './StakingTab';

const TABS = [
  { id: 'wallet', label: 'ウォレット管理', icon: '💼' },
  { id: 'account', label: 'アカウント詳細', icon: '👤' },
  { id: 'staking', label: 'Staking', icon: '🥩' },
  { id: 'transfer', label: '送信', icon: '📤' },
  { id: 'nft', label: 'NFT / アセット', icon: '🎨' },
  { id: 'objects', label: 'オブジェクト', icon: '📦' },
  { id: 'movecall', label: 'Move Call', icon: '⚙️' },
  { id: 'txhistory', label: 'Tx 履歴', icon: '📜' },
] as const;

type TabId = typeof TABS[number]['id'];

export function SuiSdkPage() {
  const [activeTab, setActiveTab] = useState<TabId>('wallet');

  const renderTab = () => {
    switch (activeTab) {
      case 'wallet': return <WalletTab />;
      case 'account': return <AccountTab />;
      case 'objects': return <ObjectsTab />;
      case 'nft': return <NftTab />;
      case 'transfer': return <TransferTab />;
      case 'movecall': return <MoveCallTab />;
      case 'txhistory': return <TransactionHistoryTab />;
      case 'staking': return <StakingTab />;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <h2 className="page-title" style={{ margin: 0 }}>⚡ Sui SDK</h2>
        <span className="badge badge-sui" style={{ fontSize: 'var(--text-xs)' }}>
          SDK Direct
        </span>
      </div>

      <div className="tabs">
        {TABS.map(tab => (
          <div
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'var(--space-lg)' }}>
        {renderTab()}
      </div>
    </div>
  );
}

