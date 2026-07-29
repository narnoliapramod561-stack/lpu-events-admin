'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
import posthog from 'posthog-js';
import Clarity from '@microsoft/clarity';
import * as Sentry from '@sentry/nextjs';
import { usePathname, useSearchParams } from 'next/navigation';

const APP_NAME = 'admin';

let posthogInitialized = false;
let clarityInitialized = false;
let gaInitialized = false;
let lastTrackedPath = '';

function loadGtag(measurementId: string) {
  if (document.getElementById('ga4-script')) return;

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer.push(args);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false,
  });
}

export function trackAdminEvent(eventName: string, properties: Record<string, unknown> = {}) {
  posthog.capture(eventName, {
    app: APP_NAME,
    ...properties,
  });
}

export function trackAdminLogin(method: 'otp' | 'google') {
  trackAdminEvent('login_started', { method });

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'login', {
      method,
      app: APP_NAME,
    });
  }
}

export function trackAdminSearch(query: string, scope?: string) {
  trackAdminEvent('search_performed', {
    search_term: query,
    scope,
  });

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'search', {
      search_term: query,
      scope,
      app: APP_NAME,
    });
  }
}

export function trackAdminEventView(eventId: string, eventTitle?: string) {
  trackAdminEvent('event_detail_viewed', {
    event_id: eventId,
    event_title: eventTitle,
  });

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'view_item', {
      items: [{ item_id: eventId, item_name: eventTitle || eventId }],
      app: APP_NAME,
    });
  }
}

export function trackAdminRegistration(eventName: string, properties: Record<string, unknown> = {}) {
  trackAdminEvent(eventName, properties);

  if (eventName === 'event_created' && typeof window.gtag === 'function') {
    window.gtag('event', 'sign_up', {
      method: 'organizer_event_creation',
      app: APP_NAME,
    });
  }
}

export function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

    if (!posthogInitialized && posthogKey && posthogHost) {
      posthog.init(posthogKey, {
        api_host: posthogHost,
        capture_pageview: false,
        capture_pageleave: true,
        autocapture: false,
        persistence: 'localStorage+cookie',
        loaded: (ph) => {
          ph.register({ app: APP_NAME });
        },
      });
      posthogInitialized = true;
    }

    const clarityProjectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (!clarityInitialized && process.env.NODE_ENV === 'production' && clarityProjectId) {
      Clarity.init(clarityProjectId);
      clarityInitialized = true;
    }

    const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (!gaInitialized && process.env.NODE_ENV === 'production' && gaMeasurementId) {
      loadGtag(gaMeasurementId);
      gaInitialized = true;
    }

    const handleError = (event: ErrorEvent) => {
      if (event.error) {
        Sentry.captureException(event.error, {
          tags: { app: APP_NAME, source: 'window.error' },
        });
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      Sentry.captureException(event.reason, {
        tags: { app: APP_NAME, source: 'window.unhandledrejection' },
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    const path = `${pathname || '/'}${searchParams?.toString() ? `?${searchParams.toString()}` : ''}`;
    if (path === lastTrackedPath) return;
    lastTrackedPath = path;

    posthog.capture('$pageview', {
      app: APP_NAME,
      path,
      title: document.title,
      url: window.location.href,
    });

    if (typeof window.gtag === 'function') {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: path,
        app: APP_NAME,
      });
    }
  }, [pathname, searchParams]);

  return null;
}
