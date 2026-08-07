import { describe, expect, it } from '@jest/globals';

import { resolveAuthorizationDestination } from '@/app/auth/callback/route';

describe('resolveAuthorizationDestination', () => {
  it('routes to access-request when no profile exists (new user)', () => {
    expect(resolveAuthorizationDestination(null, null)).toBe('/auth/access-request');
  });

  it('routes to access-request when role is pending (not yet approved)', () => {
    expect(
      resolveAuthorizationDestination({ role: 'pending', approval_status: 'pending', is_active: true }, null)
    ).toBe('/auth/access-request');
  });

  it('routes to unauthorized when role is student', () => {
    expect(
      resolveAuthorizationDestination({ role: 'student', approval_status: 'approved', is_active: true }, null)
    ).toBe('/auth/unauthorized?reason=student');
  });

  it('routes to pending page when an admin role has pending approval', () => {
    expect(
      resolveAuthorizationDestination({ role: 'organizer', approval_status: 'pending', is_active: true }, null)
    ).toBe('/auth/pending');
  });

  it('routes to rejected page when an admin role has rejected approval', () => {
    expect(
      resolveAuthorizationDestination({ role: 'organizer', approval_status: 'rejected', is_active: true }, null)
    ).toBe('/auth/rejected');
  });

  it('routes to dashboard when an admin role is approved', () => {
    expect(
      resolveAuthorizationDestination({ role: 'organizer', approval_status: 'approved', is_active: true }, null)
    ).toBe('/dashboard');
  });

  it('preserves safe next paths when approved', () => {
    expect(
      resolveAuthorizationDestination({ role: 'admin', approval_status: 'approved', is_active: true }, '/dashboard/events')
    ).toBe('/dashboard/events');
  });

  it('routes to unauthorized when disabled', () => {
    expect(
      resolveAuthorizationDestination({ role: 'organizer', approval_status: 'approved', is_active: false }, null)
    ).toBe('/auth/unauthorized?reason=disabled');
  });

  it('routes to unauthorized for unknown roles', () => {
    expect(
      resolveAuthorizationDestination({ role: 'unknown', approval_status: 'approved', is_active: true }, null)
    ).toBe('/auth/unauthorized?reason=unknown');
  });
});
