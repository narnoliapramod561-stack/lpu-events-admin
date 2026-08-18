import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading workspace data...' }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: '14px',
      color: 'var(--text-muted)'
    }}>
      <Loader2 size={32} className="pulse-dot" style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>{message}</span>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="card-box" style={{
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      opacity: 0.6
    }}>
      <div style={{ width: '40%', height: '16px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: '4px' }} />
      <div style={{ width: '80%', height: '12px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: '4px' }} />
      <div style={{ width: '60%', height: '12px', backgroundColor: 'var(--bg-surface-raised)', borderRadius: '4px' }} />
    </div>
  );
};
