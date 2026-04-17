// ==========================================
// ログパネル - CLI出力のリアルタイム表示（下部固定）
// ==========================================
import { useRef, useEffect, useState } from 'react';
import { useAppState } from '../../store/app-store';

export function LogPanel() {
  const { state, dispatch } = useAppState();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新しいログが追加されたら自動スクロール
  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.logs.length, isCollapsed]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="log-panel" style={isCollapsed ? { height: 40 } : {}}>
      <div className="log-panel-header" onClick={() => setIsCollapsed(!isCollapsed)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{isCollapsed ? '➕' : '➖'}</span>
          <span>📋 コマンドログ ({state.logs.length})</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {!isCollapsed && (
             <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '10px', padding: '2px 8px', height: '24px' }}
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CLEAR_LOGS' }); }}
            >
              クリア
            </button>
          )}
          <span style={{ opacity: 0.5, fontSize: '10px' }}>{isCollapsed ? '開く' : '閉じる'}</span>
        </div>
      </div>
      
      {!isCollapsed && (
        <div className="log-panel-content" ref={scrollRef}>
          {state.logs.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', padding: '8px 0' }}>
              ログはまだありません。
            </div>
          ) : (
            state.logs.map((log) => (
              <div key={log.id} className={`log-entry ${log.level}`}>
                <span className="log-time">{formatTime(log.timestamp)}</span>
                <span className="log-source">[{log.source}]</span>
                <div className="log-message">
                  {log.message}
                  {log.cli_path && (
                    <span style={{ color: 'var(--color-text-muted)', marginLeft: 8, fontSize: '10px' }}>
                      ({log.cli_path.split('\\').pop()})
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
