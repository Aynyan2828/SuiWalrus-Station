// ==========================================
// グローバル状態管理 (React Context)
// ==========================================
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type {
  Page, AppSettings, WalletInfo, WalletMetadata,
  ConnectionStatus, LogEntry, CommandHistoryEntry, AiMode,
  DetectedPaths, TokenBalance, ToastMessage
} from '../types';
import * as settingsService from '../services/settings-service';
import * as walletService from '../services/wallet-service';
import * as walrusService from '../services/walrus-service';
import * as suinsService from '../services/suins-service';
import * as localSiteService from '../services/local-site-service';
import { checkCliConnection } from '../services/cli-runner';
import { listen } from '@tauri-apps/api/event';
import type { WalrusBlobInfo } from '../types';

// ==========================================
// State
// ==========================================
export interface AppState {
  // ナビゲーション
  currentPage: Page;
  // 接続状態
  connection: ConnectionStatus | null;
  detectedPaths: DetectedPaths | null;
  // 設定
  settings: AppSettings;
  settingsLoaded: boolean;
  // ウォレット
  wallets: WalletInfo[];
  walletMetadata: WalletMetadata[];
  activeAddress: string;
  activeEnv: string;
  balance: string;
  tokenBalances: TokenBalance[];
  // Walrus
  walrusBlobs: WalrusBlobInfo[];
  // ログ
  logs: LogEntry[];
  // 履歴
  history: CommandHistoryEntry[];
  // UI状態
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  // AIモード
  aiMode: AiMode;
  // トースト通知
  toasts: ToastMessage[];
  // リアルタイム実行ログ
  activeExecution: {
    command: string;
    logs: { message: string, level: 'stdout' | 'stderr', timestamp: string }[];
    isExecuting: boolean;
    status: 'running' | 'success' | 'error' | null;
  } | null;
}

const initialState: AppState = {
  currentPage: 'dashboard',
  connection: null,
  detectedPaths: null,
  settings: {
    sui_cli_path: 'C:\\ProgramData\\chocolatey\\bin\\sui',
    walrus_cli_path: 'C:\\ProgramData\\walrus\\walrus',
    site_builder_cli_path: 'C:\\ProgramData\\walrus\\site-builder.exe',
    site_builder_config_path: '',
    ai_provider: 'openai',
    ai_api_key: '',
    ai_base_url: 'https://api.openai.com/v1',
    ai_model: 'gpt-4o-mini',
    ai_mode: 'guard',
    log_level: 'info',
  },
  settingsLoaded: false,
  wallets: [],
  walletMetadata: [],
  activeAddress: '',
  activeEnv: '',
  balance: '',
  tokenBalances: [],
  walrusBlobs: [],
  logs: [],
  history: [],
  isLoading: false,
  loadingMessage: '',
  error: null,
  aiMode: 'guard',
  toasts: [],
  activeExecution: null,
};

// ==========================================
// Actions
// ==========================================
type Action =
  | { type: 'SET_PAGE'; page: Page }
  | { type: 'SET_CONNECTION'; connection: ConnectionStatus }
  | { type: 'SET_DETECTED_PATHS'; paths: DetectedPaths }
  | { type: 'SET_SETTINGS'; settings: AppSettings }
  | { type: 'SETTINGS_LOADED' }
  | { type: 'SET_WALLETS'; wallets: WalletInfo[] }
  | { type: 'SET_WALLET_METADATA'; metadata: WalletMetadata[] }
  | { type: 'SET_ACTIVE_ADDRESS'; address: string }
  | { type: 'SET_ACTIVE_ENV'; env: string }
  | { type: 'SET_BALANCE'; balance: string }
  | { type: 'SET_TOKEN_BALANCES'; balances: TokenBalance[] }
  | { type: 'SET_WALRUS_BLOBS'; blobs: WalrusBlobInfo[] }
  | { type: 'ADD_LOG'; log: LogEntry }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_HISTORY'; history: CommandHistoryEntry[] }
  | { type: 'ADD_HISTORY'; entry: CommandHistoryEntry }
  | { type: 'SET_LOADING'; isLoading: boolean; message?: string }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_AI_MODE'; mode: AiMode }
  | { type: 'ADD_TOAST'; toast: ToastMessage }
  | { type: 'REMOVE_TOAST'; id: string }
  | { type: 'START_EXECUTION'; command: string }
  | { type: 'ADD_REALTIME_LOG'; log: { message: string, level: 'stdout' | 'stderr' } }
  | { type: 'END_EXECUTION'; status: 'success' | 'error' };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_PAGE':
      return { ...state, currentPage: action.page };
    case 'SET_CONNECTION':
      return { ...state, connection: action.connection };
    case 'SET_DETECTED_PATHS':
      return { ...state, detectedPaths: action.paths };
    case 'SET_SETTINGS':
      return { ...state, settings: action.settings, aiMode: action.settings.ai_mode };
    case 'SETTINGS_LOADED':
      return { ...state, settingsLoaded: true };
    case 'SET_WALLETS':
      return { ...state, wallets: action.wallets };
    case 'SET_WALLET_METADATA':
      return { ...state, walletMetadata: action.metadata };
    case 'SET_ACTIVE_ADDRESS':
      return { ...state, activeAddress: action.address };
    case 'SET_ACTIVE_ENV':
      return { ...state, activeEnv: action.env };
    case 'SET_BALANCE':
      return { ...state, balance: action.balance };
    case 'SET_TOKEN_BALANCES':
      return { ...state, tokenBalances: action.balances };
    case 'SET_WALRUS_BLOBS':
      return { ...state, walrusBlobs: action.blobs };
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs.slice(-200), action.log] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'SET_HISTORY':
      return { ...state, history: action.history };
    case 'ADD_HISTORY':
      return { ...state, history: [action.entry, ...state.history].slice(0, 500) };
    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading, loadingMessage: action.message || '' };
    case 'SET_ERROR':
      return { ...state, error: action.error };
    case 'SET_AI_MODE':
      return { ...state, aiMode: action.mode };
    case 'ADD_TOAST':
      return { ...state, toasts: [...state.toasts, action.toast] };
    case 'REMOVE_TOAST':
      return { ...state, toasts: state.toasts.filter(t => t.id !== action.id) };
    case 'START_EXECUTION':
      return {
        ...state,
        activeExecution: {
          command: action.command,
          logs: [],
          isExecuting: true,
          status: 'running'
        }
      };
    case 'ADD_REALTIME_LOG':
      if (!state.activeExecution) return state;
      return {
        ...state,
        activeExecution: {
          ...state.activeExecution,
          logs: [...state.activeExecution.logs.slice(-50), { ...action.log, timestamp: new Date().toISOString() }]
        }
      };
    case 'END_EXECUTION':
      if (!state.activeExecution) return state;
      return {
        ...state,
        activeExecution: {
          ...state.activeExecution,
          isExecuting: false,
          status: action.status
        }
      };
    default:
      return state;
  }
}

// ==========================================
// Context
// ==========================================
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  addLog: (level: LogEntry['level'], source: string, message: string, extra?: Partial<LogEntry>) => void;
  refreshWallets: () => Promise<void>;
  refreshWalrus: () => Promise<void>;
  refreshConnection: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useAppState() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppState must be used within AppProvider');
  return ctx;
}

// ==========================================
// Provider
// ==========================================
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // ログ追加ヘルパー
  const addLog = useCallback((
    level: LogEntry['level'],
    source: string,
    message: string,
    extra?: Partial<LogEntry>,
  ) => {
    dispatch({
      type: 'ADD_LOG',
      log: {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        level,
        source,
        message,
        ...extra,
      },
    });
  }, []);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    dispatch({
      type: 'ADD_TOAST',
      toast: { ...toast, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', id });
  }, []);

  // ウォレット情報のリフレッシュ
  const refreshWallets = useCallback(async () => {
    try {
      const wallets = await walletService.getWallets(state.settings.sui_cli_path);
      dispatch({ type: 'SET_WALLETS', wallets });

      const activeAddr = await walletService.getActiveAddress(state.settings.sui_cli_path);
      dispatch({ type: 'SET_ACTIVE_ADDRESS', address: activeAddr });

      const env = await walletService.getActiveEnv(state.settings.sui_cli_path);
      dispatch({ type: 'SET_ACTIVE_ENV', env });

      const balance = await walletService.getBalance(undefined, state.settings.sui_cli_path);
      dispatch({ type: 'SET_BALANCE', balance });

      const allBalances = await walletService.getAllBalances(undefined, state.settings.sui_cli_path);
      dispatch({ type: 'SET_TOKEN_BALANCES', balances: allBalances });

      addLog('info', 'ウォレット', `ウォレット情報を更新しました (${wallets.length}件, ${allBalances.length}種類のトークン)`);
    } catch (error) {
      addLog('error', 'ウォレット', `ウォレット情報取得エラー: ${error}`);
    }
  }, [state.settings.sui_cli_path, addLog]);

  // Walrus情報の詳細取得（SuiNSマッピング込み）
  const refreshWalrus = useCallback(async () => {
    try {
      addLog('info', 'Walrus', 'Blob一覧とSuiNSマッピングを取得中...');
      
      // 1. Blob一覧取得
      const blobs = await walrusService.listBlobs(state.settings.walrus_cli_path);
      
      // 2. ローカルデプロイ履歴の取得 (site-config.yaml から動的にスキャン)
      const scanResult = await localSiteService.scanConfigSites(state.settings.site_builder_config_path);
      const localSites = scanResult.sites;
      
      // スキャンプロセスをログに出力
      scanResult.logs.forEach(log => addLog('info', 'Walrus', log));
      
      // デフォルトパスも念のためチェック（もしあれば）
      for (const path of localSiteService.DEFAULT_SCAN_PATHS) {
        const info = await localSiteService.getLocalSiteInfo(path);
        if (info && !localSites.find(s => s.object_id === info.object_id)) {
          localSites.push(info);
        }
      }
      
      if (localSites.length > 0) {
        addLog('info', 'Walrus', `合計 ${localSites.length} 件のサイト情報を統合しました`);
      } else if (scanResult.logs.length === 0) {
        addLog('warn', 'Walrus', 'ローカルのデプロイ履歴が見つからんかったばい。設定を確認してね。');
      }

      // 3. ローカルサイトの最新Blob IDをオンチェーンから解決
      for (const site of localSites) {
        addLog('info', 'Walrus', `サイト "${site.site_name}" (ID: ${site.object_id.slice(0,8)}...) の最新Blob IDを解決中...`);
        const latestBlobId = await suinsService.getLatestBlobIdFromSite(site.object_id, state.settings.sui_cli_path);
        
        if (latestBlobId) {
          addLog('info', 'Walrus', `✨ サイト "${site.site_name}" の実体 (Blob: ${latestBlobId.slice(0,8)}...) を特定したばい！`);
          site.blob_id = latestBlobId;
        } else {
          addLog('warn', 'Walrus', `⚠️ サイト "${site.site_name}" の実体(Blob)が見つかりません。Sui上のオブジェクトが存在するか、またはネットワーク設定を確認してください。`);
        }
      }

      // 4. SuiNS / Site マッピング取得
      const activeAddr = state.activeAddress || await walletService.getActiveAddress(state.settings.sui_cli_path);
      const mappings = await suinsService.getDomainMappings(activeAddr, state.settings.sui_cli_path);
      
      // 5. マージ処理 (Site Object ID 主導)
      const isMainnet = state.activeEnv.toLowerCase().includes('mainnet');
      const finalBlobs: WalrusBlobInfo[] = [];
      const processedBlobIds = new Set<string>();

      // A. ローカル履歴およびSuiNSマッピングから、Site情報を構築
      const siteRegistry = new Map<string, { name: string, blobId?: string, isLocal: boolean, objectId: string }>();

      // ローカル履歴を登録
      localSites.forEach(s => {
        siteRegistry.set(s.object_id, { name: s.site_name, blobId: s.blob_id, isLocal: true, objectId: s.object_id });
      });

      // SuiNSマッピングを統合
      mappings.forEach(m => {
        const existing = siteRegistry.get(m.objectId);
        siteRegistry.set(m.objectId, {
          name: existing?.name || m.domain,
          blobId: existing?.blobId || (m.type === 'site' ? undefined : m.blobId),
          isLocal: existing?.isLocal || false,
          objectId: m.objectId
        });
      });

      // B. アクティブな Blob と Site 情報を紐付け
      for (const blob of blobs) {
        // Blob ID または Site ID で Registry から検索
        let siteInfo = Array.from(siteRegistry.values()).find(s => s.blobId === blob.blob_id || s.objectId === blob.blob_id);
        
        if (siteInfo) {
          processedBlobIds.add(blob.blob_id);
        }

        finalBlobs.push({
          ...blob,
          site_title: siteInfo?.name,
          suins_name: mappings.find(m => m.objectId === siteInfo?.objectId && m.type === 'suins')?.domain,
          site_url: suinsService.getPortalUrl(blob.blob_id, isMainnet),
          is_local_site: !!siteInfo?.isLocal,
          site_object_id: siteInfo?.objectId,
          is_offline: false
        });
      }

      // C. 履歴にあるが、まだアクティブなリストに入っていないサイト（期限切れ等）を追加
      for (const siteInfo of siteRegistry.values()) {
        if (siteInfo.blobId && !processedBlobIds.has(siteInfo.blobId)) {
          const mapping = mappings.find(m => m.objectId === siteInfo.objectId && m.type === 'suins');
          addLog('info', 'Walrus', `オフラインサイトをリストに追加しました: ${siteInfo.name}`);
          
          finalBlobs.push({
            blob_id: siteInfo.blobId, 
            size: 0,
            status: 'expired',
            site_title: siteInfo.name,
            suins_name: mapping?.domain,
            site_url: suinsService.getPortalUrl(siteInfo.blobId, isMainnet),
            is_local_site: siteInfo.isLocal,
            is_offline: true,
            site_object_id: siteInfo.objectId
          });
        }
      }

      // 並び替え (ローカル・バッジ付きを最優先)
      finalBlobs.sort((a, b) => (b.is_local_site ? 1 : 0) - (a.is_local_site ? 1 : 0));

      dispatch({ type: 'SET_WALRUS_BLOBS', blobs: finalBlobs });
      addLog('info', 'Walrus', `Walrus情報を更新しました (${finalBlobs.length}個のBlob/サイトを表示中)`);
    } catch (error) {
      addLog('error', 'Walrus', `Walrus情報取得エラー: ${error}`);
    }
  }, [state.settings.walrus_cli_path, state.settings.sui_cli_path, state.activeAddress, state.activeEnv, addLog]);

  // 接続確認のリフレッシュ
  const refreshConnection = useCallback(async () => {
    try {
      const connection = await checkCliConnection(
        state.settings.sui_cli_path,
        state.settings.walrus_cli_path,
        state.settings.site_builder_cli_path,
      );
      dispatch({ type: 'SET_CONNECTION', connection });

      // 設定パス自動検出
      const paths = await settingsService.detectConfigPaths();
      dispatch({ type: 'SET_DETECTED_PATHS', paths });

      addLog('info', 'システム', `Sui CLI: ${connection.sui_available ? '✅' : '❌'} ${connection.sui_version}`);
      addLog('info', 'システム', `Walrus CLI: ${connection.walrus_available ? '✅' : '❌'} ${connection.walrus_version}`);
      addLog('info', 'システム', `Site Builder: ${connection.site_builder_available ? '✅' : '❌'} ${connection.site_builder_version}`);
      addLog('info', 'システム', `Sui設定: ${paths.sui_config_dir || '未検出'}`);
      addLog('info', 'システム', `Walrus設定: ${paths.walrus_config_dir || '未検出'}`);
    } catch (error) {
      addLog('error', 'システム', `接続確認エラー: ${error}`);
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [state.settings.sui_cli_path, state.settings.walrus_cli_path, addLog]);

  // 初期化
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        // 設定読み込み
        const settings = await settingsService.getSettings();
        if (mounted) {
          dispatch({ type: 'SET_SETTINGS', settings });
          dispatch({ type: 'SETTINGS_LOADED' });
        }

        // 履歴読み込み
        const history = await settingsService.loadCommandHistory();
        if (mounted) dispatch({ type: 'SET_HISTORY', history });

        // ウォレットメタデータ読み込み
        const metadata = await settingsService.loadWalletMetadata();
        if (mounted) dispatch({ type: 'SET_WALLET_METADATA', metadata });
      } catch (error) {
        console.error('初期化エラー:', error);
        if (mounted) dispatch({ type: 'SETTINGS_LOADED' });
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  // リアルタイムログリスナーの登録
  useEffect(() => {
    const unlisten = listen<{ message: string, level: 'stdout' | 'stderr' }>('cli-realtime-log', (event) => {
      dispatch({ type: 'ADD_REALTIME_LOG', log: event.payload });
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  // 設定読み込み後に接続確認とウォレット取得
  useEffect(() => {
    if (state.settingsLoaded) {
      refreshConnection().then(() => {
        refreshWallets();
        refreshWalrus();
      });
    }
  }, [state.settingsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AppContext.Provider value={{ state, dispatch, addLog, refreshWallets, refreshWalrus, refreshConnection, addToast, removeToast }}>
      {children}
    </AppContext.Provider>
  );
}
