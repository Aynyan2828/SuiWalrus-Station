import { useEffect } from 'react';
import { useAppState } from '../store/app-store';

export function ToastContainer() {
  const { state, removeToast } = useAppState();

  return (
    <div
      style={{
        position: 'fixed',
        top: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        pointerEvents: 'none',
      }}
    >
      {state.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: any; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const getColors = () => {
    switch (toast.type) {
      case 'success':
        return { bg: 'var(--color-success)', text: '#fff' };
      case 'error':
        return { bg: 'var(--color-error)', text: '#fff' };
      default:
        return { bg: 'var(--color-sui)', text: '#fff' };
    }
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success': return '✅';
      case 'error': return '❌';
      default: return 'ℹ️';
    }
  };

  const colors = getColors();

  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        borderLeft: `4px solid ${colors.bg}`,
        boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 16px',
        minWidth: 280,
        maxWidth: 400,
        pointerEvents: 'auto',
        animation: 'slideInRight 0.3s ease-out forwards',
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ fontSize: '18px' }}>{getIcon()}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-text-primary)' }}>
          {toast.title}
        </span>
        {toast.message && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>
            {toast.message}
          </span>
        )}
      </div>
      <button
        onClick={onRemove}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          padding: 4,
          fontSize: '12px',
        }}
      >
        ✕
      </button>
    </div>
  );
}
