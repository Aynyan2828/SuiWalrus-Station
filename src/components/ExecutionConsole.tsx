import React, { useEffect, useRef, useState } from 'react';
import { useAppState } from '../store/app-store';

export function ExecutionConsole() {
  const { state, dispatch } = useAppState();
  const { activeExecution } = state;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // 実行状態が変わったら表示を切り替える
  useEffect(() => {
    if (activeExecution?.isExecuting) {
      setIsVisible(true);
    } else if (activeExecution && !activeExecution.isExecuting) {
      // 成功/失敗時は3秒後に自動で閉じる
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [activeExecution?.isExecuting]);

  // 新しいログが来たら自動スクロール
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeExecution?.logs.length]);

  if (!activeExecution || (!isVisible && !activeExecution.isExecuting)) return null;

  const getStatusColor = () => {
    switch (activeExecution.status) {
      case 'success': return 'var(--color-success)';
      case 'error': return 'var(--color-error)';
      case 'running': return 'var(--color-walrus)';
      default: return 'var(--color-text-muted)';
    }
  };

  const statusColor = getStatusColor();

  return (
    <div
      className="execution-console-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        pointerEvents: 'none',
        animation: isVisible ? 'slideDownIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'slideUpOut 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '800px',
          background: 'rgba(10, 15, 25, 0.85)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderRadius: 'var(--radius-lg)',
          border: `1px solid ${statusColor}`,
          boxShadow: `0 20px 40px rgba(0, 0, 0, 0.5), 0 0 20px ${statusColor}33`,
          pointerEvents: 'auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '40vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className={`status-dot ${activeExecution.isExecuting ? 'pulse' : ''}`} style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }}></div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>
              {activeExecution.isExecuting ? 'EXECUTING...' : `FINISHED (${activeExecution.status?.toUpperCase()})`}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            $ {activeExecution.command}
          </div>
          <button 
            onClick={() => setIsVisible(false)}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Log Area */}
        <div
          ref={scrollRef}
          style={{
            padding: '16px',
            overflowY: 'auto',
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
          }}
        >
          {activeExecution.logs.length === 0 ? (
            <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Waiting for output...</div>
          ) : (
            activeExecution.logs.map((log, i) => (
              <div key={i} style={{ marginBottom: '4px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--color-text-muted)', minWidth: 65, opacity: 0.5, fontSize: '10px', paddingTop: '2px' }}>
                  [{log.timestamp.split('T')[1].split('.')[0]}]
                </span>
                <span style={{ 
                  color: log.level === 'stderr' ? 'var(--color-error)' : 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  flex: 1
                }}>
                  {log.message}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer / Progress bar */}
        {activeExecution.isExecuting && (
          <div style={{ height: '2px', background: 'rgba(255,255,255,0.1)', position: 'relative' }}>
            <div className="console-progress-bar"></div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideDownIn {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideUpOut {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(-100%); opacity: 0; }
        }
        @keyframes pulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
        .status-dot.pulse {
          animation: pulse 1.5s infinite ease-in-out;
        }
        .console-progress-bar {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: var(--color-walrus);
          width: 30%;
          animation: moveProgress 2s infinite linear;
        }
        @keyframes moveProgress {
          0% { left: -30%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
