import React from 'react';
import { LogOut, User, Menu } from 'lucide-react';

export interface HeaderProps {
  title: string;
  userEmail: string;
  roleDisplay: string;
  badgeClass?: string;
  onLogout: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  userEmail,
  roleDisplay,
  badgeClass,
  onLogout,
  onToggleMobileMenu,
}) => {
  return (
    <header className="admin-header">
      {/* Title & Mobile Toggle */}
      <div className="admin-header-left">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="btn btn-secondary btn-icon"
            style={{ display: 'flex' }}
          >
            <Menu size={18} />
          </button>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Portal Console
            </span>
            <span style={{ color: 'var(--text-dim)', fontSize: '12px' }}>/</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {roleDisplay}
            </span>
          </div>
          <h1 className="font-heading" style={{ fontSize: '19px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            {title}
          </h1>
        </div>
      </div>

      {/* User Context & Actions */}
      <div className="admin-header-right">
        {/* User Identity Card */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '6px 14px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-surface-raised)',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-surface-active)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-primary)',
            border: '1px solid var(--border-subtle)'
          }}>
            <User size={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.2 }}>
              {userEmail}
            </span>
            <span className={badgeClass || 'badge badge-purple'} style={{ fontSize: '9.5px', padding: '1px 6px', marginTop: '3px', width: 'fit-content' }}>
              {roleDisplay}
            </span>
          </div>
        </div>

        {/* Logout action */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onLogout}
          title="Sign out of Admin Console"
        >
          <LogOut size={15} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};
