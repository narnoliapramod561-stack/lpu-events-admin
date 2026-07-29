import { describe, expect, it } from '@jest/globals';

import { resolveCallbackDestination } from '@/app/auth/callback/route';

describe('resolveCallbackDestination', () => {
  it('routes admin OAuth callbacks to the admin dashboard when the profile role is missing', () => {
    expect(resolveCallbackDestination(null, 'admin', null)).toBe('/dashboard');
  });

  it('preserves organizer dashboard redirects when the profile role is organizer', () => {
    expect(resolveCallbackDestination(null, null, 'organizer')).toBe('/dashboard');
  });

  it('keeps safe next paths when present', () => {
    expect(resolveCallbackDestination('/dashboard/events', 'admin', null)).toBe('/dashboard/events');
  });

  it('rejects unsafe next paths and falls back to the admin dashboard', () => {
    expect(resolveCallbackDestination('https://evil.test', 'admin', null)).toBe('/dashboard');
  });
});
