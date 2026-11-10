import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/shell/ErrorBoundary.tsx';
import { initPostHog, captureOrBufferException } from '@lpu-events/shared';
import './index.css';

// Initialize production observability & telemetry for Admin Website (PostHog-Only)
initPostHog({
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  apiHost: import.meta.env.VITE_POSTHOG_HOST,
  app: 'admin',
  environment: import.meta.env.PROD ? 'production' : 'development'
});

if (typeof window !== 'undefined') {
  // Global uncaught JavaScript runtime error listener (non-destructive)
  window.addEventListener('error', (event: ErrorEvent) => {
    if (!event.error && !event.message) return;
    captureOrBufferException(event.error || new Error(event.message), {
      source: 'window.addEventListener_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Global unhandled promise rejection listener (non-destructive)
  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    if (reason && (reason.name === 'AbortError' || reason.code === 20)) return;
    captureOrBufferException(
      reason instanceof Error ? reason : new Error(String(reason || 'Unhandled Promise Rejection')),
      {
        source: 'window.addEventListener_unhandledrejection',
      }
    );
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
