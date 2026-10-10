import React from 'react';
import { Menu, Moon, Sun } from 'lucide-react';

export interface HeaderProps {
  title: string;
  userEmail: string;
  displayName?: string;
  roleDisplay: string;
  badgeClass?: string;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  onLogout?: () => void;
  onToggleMobileMenu?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  userEmail,
  displayName,
  roleDisplay,
  badgeClass,
  darkMode,
  onToggleDarkMode,
  onToggleMobileMenu,
}) => {
  const initialLetter = (displayName || userEmail || 'A').charAt(0).toUpperCase();

  return (
    <header className="admin-header">
      {/* Title & Mobile Toggle */}
      <div className="admin-header-left">
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="btn btn-secondary btn-icon"
            style={{ display: 'flex' }}
            title="Toggle Menu"
          >
            <Menu size={18} />
          </button>
        )}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin
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

      {/* Top Right: Mode Switcher + Account Identity Card */}
      <div className="admin-header-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {onToggleDarkMode && (
          <button
            type="button"
            onClick={onToggleDarkMode}
            className="btn btn-secondary btn-icon"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface-raised)',
              color: 'var(--text-main)'
            }}
            title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        )}

        {/* User Identity Chip */}
        {(userEmail || displayName) && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '5px 14px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--bg-surface-raised)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-primary)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '12px',
              flexShrink: 0
            }}>
              {initialLetter}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', maxWidth: '200px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-main)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={userEmail}>
                {userEmail || displayName}
              </span>
              <span className={badgeClass} style={{ fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--accent-primary)', letterSpacing: '0.04em', lineHeight: 1, marginTop: '2px' }}>
                {roleDisplay || 'ORGANIZER'}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

