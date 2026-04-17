// ==========================================
// サイドバー - ナビゲーション + AIモード表示
// ==========================================
import { useAppState } from '../../store/app-store';
import { getAiModeLabel } from '../../services/ai-guard-service';
import type { AiMode, Page } from '../../types';

const NAV_ITEMS: { page: Page; icon: string; label: string; section?: string }[] = [
  { page: 'dashboard', icon: '📊', label: 'ダッシュボード', section: 'メイン' },
  { page: 'wallet', icon: '💼', label: 'ウォレット' },
  { page: 'sui', icon: '🔗', label: 'Sui 操作', section: 'ツール' },
  { page: 'sui-sdk', icon: '⚡', label: 'Sui SDK' },
  { page: 'ai-agent', icon: '🤖', label: 'AI Agent' },
  { page: 'walrus', icon: '🐋', label: 'Walrus 操作' },
  { page: 'history', icon: '📜', label: '実行履歴', section: '管理' },
  { page: 'settings', icon: '⚙️', label: '設定' },
];

export function Sidebar() {
  const { state, dispatch } = useAppState();

  const cycleAiMode = () => {
    const modes: AiMode[] = ['guard', 'explain', 'off'];
    const currentIdx = modes.indexOf(state.aiMode);
    const nextMode = modes[(currentIdx + 1) % modes.length];
    dispatch({ type: 'SET_AI_MODE', mode: nextMode });
  };

  let currentSection = '';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo.png" alt="Logo" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', objectFit: 'cover' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 style={{ fontSize: '1.1rem', marginBottom: 0 }}>SuiWalrus</h1>
          <span className="version" style={{ alignSelf: 'flex-start', marginTop: 2 }}>Station v0.1</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const showSection = item.section && item.section !== currentSection;
          if (item.section) currentSection = item.section;

          return (
            <div key={item.page}>
              {showSection && (
                <div className="sidebar-section-label">{item.section}</div>
              )}
              <div
                className={`nav-item ${state.currentPage === item.page ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_PAGE', page: item.page })}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="ai-mode-toggle" onClick={cycleAiMode}>
          <span>🤖</span>
          <span>AI: {getAiModeLabel(state.aiMode)}</span>
        </div>
      </div>
    </aside>
  );
}
