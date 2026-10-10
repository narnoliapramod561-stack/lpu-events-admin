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
    try {
      sessionStorage.removeItem('lpu_superadmin_active_tab');
      sessionStorage.removeItem('lpu_organizer_active_tab');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.href = window.location.origin;
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const rawErr = this.state.error;
      const errorTitle = rawErr instanceof Error ? `${rawErr.name}: ${rawErr.message}` : (typeof rawErr === 'object' && rawErr !== null ? JSON.stringify(rawErr) : String(rawErr || 'Unexpected render error'));
      const errorStack = rawErr instanceof Error ? rawErr.stack : undefined;

      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#fff8f6',
          padding: '24px',
          fontFamily: "'Inter', sans-serif"
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            padding: '36px',
            borderRadius: '16px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            border: '1px solid #e2bfb0',
            boxShadow: '0 8px 30px rgba(38, 24, 18, 0.08)'
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

            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#261812', marginBottom: '10px' }}>
              Something Went Wrong
            </h2>

            <p style={{ fontSize: '14px', color: '#5a4136', lineHeight: '1.6', marginBottom: '20px' }}>
              An unexpected render error occurred in the administrative console. The error has been logged safely.
            </p>

            <div style={{
              textAlign: 'left',
              backgroundColor: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '24px',
              fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace",
              color: '#b91c1c',
              maxHeight: '220px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              <strong style={{ display: 'block', marginBottom: '6px' }}>Error Details:</strong>
              {errorTitle}
              {errorStack && `\n\nStack Trace:\n${errorStack}`}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#ff6b00',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '14px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255, 107, 0, 0.35)',
                  transition: 'background-color 0.2s'
                }}
              >
                Reload & Return to Home
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(`${errorTitle}\n\n${errorStack || ''}`);
                    alert('Error details copied to clipboard');
                  } catch {
                    // ignore
                  }
                }}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  border: '1px solid #e2bfb0',
                  backgroundColor: '#fff8f6',
                  color: '#261812',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Copy Error
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
