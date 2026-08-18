import React, { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="card-box" style={{
      padding: '48px 24px',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '20px 0',
      borderStyle: 'dashed'
    }}>
      <div style={{
        width: '56px',
        height: '56px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-surface-raised)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-dim)',
        marginBottom: '16px',
        border: '1px solid var(--border-subtle)'
      }}>
        {icon || <Inbox size={26} />}
      </div>
      <h3 className="font-heading" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
        {title}
      </h3>
      <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', maxWidth: '420px', lineHeight: 1.5, marginBottom: actionLabel && onAction ? '20px' : 0 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-primary btn-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
