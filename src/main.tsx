import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/shell/ErrorBoundary.tsx';
import { initPostHog, initClarity, initSentry } from '@lpu-events/shared';
import './index.css';

// Initialize production observability & telemetry for Admin Website
initSentry({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development',
  release: import.meta.env.VITE_SENTRY_RELEASE || '1.0.0',
  app: 'admin'
});

initPostHog({
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  apiHost: import.meta.env.VITE_POSTHOG_HOST,
  app: 'admin',
  environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development'
});

// Admin recordings strictly mask all text, input fields, and user details
initClarity({
  projectId: import.meta.env.VITE_CLARITY_PROJECT_ID,
  maskAllText: true
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
