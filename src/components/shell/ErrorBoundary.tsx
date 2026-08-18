import { Component, ErrorInfo, ReactNode } from 'react';
import { captureSafeException } from '@lpu-events/shared';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AdminShell:ErrorBoundary] Render error caught:', error, errorInfo);
    captureSafeException(error, {
      componentStack: errorInfo.componentStack,
      surface: 'admin-web-react-shell'
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          padding: '24px'
        }}>
          <div className="glass-card premium-breath-glow" style={{
            maxWidth: '480px',
            width: '100%',
            padding: '36px',
            borderRadius: '16px',
            textAlign: 'center',
            background: 'var(--glass)',
            border: '1px solid var(--border)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px auto',
              fontSize: '24px',
              fontWeight: 'bold'
            }}>
              ⚠️
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '10px' }}>
              Something Went Wrong
            </h2>

            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px' }}>
              An unexpected render error occurred in the administrative console. The error has been logged safely.
            </p>

            <button
              onClick={this.handleReset}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#ffffff',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-orange)'
              }}
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
