import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/shell/ErrorBoundary.tsx';
import { initPostHog } from '@lpu-events/shared';
import './index.css';

// Initialize production observability & telemetry for Admin Website (PostHog-Only)
initPostHog({
  apiKey: import.meta.env.VITE_POSTHOG_KEY,
  apiHost: import.meta.env.VITE_POSTHOG_HOST,
  app: 'admin',
  environment: import.meta.env.PROD ? 'production' : 'development'
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
