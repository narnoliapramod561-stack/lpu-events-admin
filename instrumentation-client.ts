import * as Sentry from '@sentry/nextjs';
import posthog from 'posthog-js';
import clarity from '@microsoft/clarity';
import { getPublicEnv } from './lib/env';

const publicEnv = getPublicEnv();

const dsn = publicEnv.NEXT_PUBLIC_SENTRY_DSN;
const posthogKey = publicEnv.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = publicEnv.NEXT_PUBLIC_POSTHOG_HOST;
const clarityProjectId = publicEnv.NEXT_PUBLIC_CLARITY_PROJECT_ID;
const gaMeasurementId = publicEnv.NEXT_PUBLIC_GA_MEASUREMENT_ID;

function readSampleRate(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) {
    return parsed;
  }
  return fallback;
}

// Initialize Sentry
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: publicEnv.NEXT_PUBLIC_APP_VERSION || 'admin@unknown',
    tracesSampleRate: readSampleRate(publicEnv.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, 0.1),
    replaysSessionSampleRate: readSampleRate(publicEnv.NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0.01),
    replaysOnErrorSampleRate: readSampleRate(publicEnv.NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 1.0),
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration()
    ],
    beforeSend(event) {
      event.tags = {
        ...event.tags,
        app: 'admin',
      };
      return event;
    },
  });
}

// Initialize PostHog
if (posthogKey && posthogHost) {
  posthog.init(posthogKey, {
    api_host: posthogHost,
    capture_pageview: false, // We'll handle page views manually
    capture_pageleave: true,
    autocapture: false,
    persistence: 'localStorage+cookie',
    loaded: (ph) => {
      ph.register({ app: 'admin' });
    },
  });
}

// Initialize Microsoft Clarity
if (typeof window !== 'undefined' && clarityProjectId && process.env.NODE_ENV === 'production') {
  clarity.init(clarityProjectId);
}

// Load Google Analytics 4
if (typeof window !== 'undefined' && gaMeasurementId && process.env.NODE_ENV === 'production') {
  // Load GA4 script
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`;
  document.head.appendChild(script);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', gaMeasurementId, {
    send_page_view: false,
  });
}

// Track page views for all services
export function trackPageView(path: string) {
  // Track with PostHog
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture('$pageview', {
      app: 'admin',
      path,
      url: window.location.href,
      title: document.title,
    });
  }

  // Track with GA4
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: path,
      app: 'admin',
    });
  }

  // Track with Clarity (automatic)
  if (typeof window !== 'undefined' && clarityProjectId && process.env.NODE_ENV === 'production') {
    // Clarity tracks page views automatically after initialization
  }
}

// Capture router transitions
export const onRouterTransitionStart = (url: string) => {
  Sentry.captureMessage(`Navigating to ${url}`, 'info');
  trackPageView(url);
};


