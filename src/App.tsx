// ==========================================
// SuiWalrus Station - ルートコンポーネント
// ==========================================
import { AppProvider, useAppState } from './store/app-store';
import { AgentProvider } from './store/agent-store';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { LogPanel } from './components/Layout/LogPanel';
import { ToastContainer } from './components/ToastContainer';
import { Dashboard } from './pages/Dashboard';
import { WalletPage } from './pages/WalletPage';
import { SuiPage } from './pages/SuiPage';
import { WalrusPage } from './pages/WalrusPage';
import { HistoryPage } from './pages/HistoryPage';
import { SettingsPage } from './pages/SettingsPage';
import { SuiSdkPage } from './pages/sui-sdk/SuiSdkPage';
import { AiAgentPage } from './pages/ai-agent/AiAgentPage';

function AppContent() {
  const { state } = useAppState();

  const renderPage = () => {
    switch (state.currentPage) {
      case 'dashboard': return <Dashboard />;
      case 'wallet': return <WalletPage />;
      case 'sui': return <SuiPage />;
      case 'sui-sdk': return <SuiSdkPage />;
      case 'ai-agent': return <AiAgentPage />;
      case 'walrus': return <WalrusPage />;
      case 'history': return <HistoryPage />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Header />
        <div className="content-area">
          {renderPage()}
        </div>
        <LogPanel />
      </div>

      <ToastContainer />

      {state.isLoading && (
        <div className="loading-overlay">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" />
            <p style={{ marginTop: 16, color: 'var(--color-text-secondary)' }}>
              {state.loadingMessage || '読み込み中...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AgentProvider>
        <AppContent />
      </AgentProvider>
    </AppProvider>
  );
}
