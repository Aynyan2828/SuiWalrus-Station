// ==========================================
// AI Agent ページ機能のルート
// ==========================================
import { useState, useEffect } from 'react';
import { AgentChatPanel, AgentRuleList, AgentApprovalQueue, AgentHistoryPanel } from './AgentPanels';
import { useAgentState } from '../../store/agent-store';
import { useAgentScheduler } from '../../services/ai-agent/agent-scheduler';
import { getLatestPriceUSD } from '../../services/ai-agent/price-oracle';

const TABS = [
  { id: 'chat', label: '新規ルール (Chat)', icon: '💬' },
  { id: 'rules', label: 'ルール一覧', icon: '📋' },
  { id: 'approval', label: 'タスク承認', icon: '⏳' },
  { id: 'history', label: '実行履歴', icon: '📜' },
] as const;

type TabId = typeof TABS[number]['id'];

export function AiAgentPage() {
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [suiPrice, setSuiPrice] = useState<number | null>(null);
  const { state } = useAgentState();
  
  // スケジューラ起動（このページを開いている間に動く）
  useAgentScheduler();

  // 軽量なリアルタイム価格取得 (15秒更新)
  useEffect(() => {
    const fetchPrice = async () => {
      const price = await getLatestPriceUSD('SUI');
      if (price) setSuiPrice(price);
    };
    
    fetchPrice(); // 初回実行
    const interval = setInterval(fetchPrice, 15000);
    return () => clearInterval(interval);
  }, []);

  const renderTab = () => {
    switch (activeTab) {
      case 'chat': return <AgentChatPanel />;
      case 'rules': return <AgentRuleList />;
      case 'approval': return <AgentApprovalQueue />;
      case 'history': return <AgentHistoryPanel />;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>🤖 AI Agent</h2>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            自然文の指示を受け取り、ローカルでルールに沿って安全に半自動実行するエージェントです。
          </p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {suiPrice !== null && (
            <span className="badge" style={{ fontSize: 'var(--text-xs)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--color-border)', color: 'var(--text-primary)' }}>
              SUI Price: <strong style={{ color: 'var(--color-success)', marginLeft: 4 }}>${suiPrice.toFixed(4)}</strong>
            </span>
          )}
          <span className="badge badge-sui" style={{ fontSize: 'var(--text-xs)' }}>
            Status: Active
          </span>
          {state.tasks.some(t => t.status === 'pending_approval') && (
            <span className="badge badge-error" style={{ fontSize: 'var(--text-xs)' }}>
              承認待ちあり
            </span>
          )}
        </div>
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
