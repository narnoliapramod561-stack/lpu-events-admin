import { getPublicEnv } from '@/lib/env';

export function getSiteUrl() {
  return getPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}

export function buildAbsoluteUrl(path = '/') {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${normalized}`;
}
