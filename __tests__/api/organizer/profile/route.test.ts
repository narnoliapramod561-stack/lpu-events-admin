/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/organizer-guard', () => ({
  validateOrganizer: jest.fn(),
}));

jest.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: jest.fn(),
}));

import { validateOrganizer } from '@/lib/auth/organizer-guard';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { GET, PUT } from '@/app/api/organizer/profile/route';

const mockValidateOrganizer = validateOrganizer as jest.Mock;
const mockCreateServiceRoleClient = createServiceRoleClient as jest.Mock;

const createSelectChain = (result: unknown) => ({
  select: jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      single: jest.fn().mockResolvedValue(result),
    }),
  }),
});

const createUpdateChain = (result: unknown, capture?: (value: unknown) => void) => ({
  update: jest.fn().mockImplementation((value: unknown) => {
    capture?.(value);
    return {
      eq: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue(result),
        }),
      }),
    };
  }),
});

const createRequest = (method: 'GET' | 'PUT', body?: unknown, headers?: Record<string, string>) => {
  return new NextRequest('http://localhost:3000/api/organizer/profile', {
    method,
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
};

describe('Organizer Profile APIs', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockValidateOrganizer.mockResolvedValue({
      status: 200,
      message: 'Authorized',
      user: { id: 'test-user-id', role: 'organizer' },
    });
  });

  describe('GET /api/organizer/profile', () => {
    it('should return 401 for unauthorized request', async () => {
      const request = createRequest('GET', undefined, { Authorization: '' });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should return profile data for successful GET', async () => {
      const mockProfile = {
        id: 'test-user-id',
        email: 'organizer@example.com',
        full_name: 'John Doe',
        phone: '+91 98765 43210',
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'organizer',
        registration_number: 'LPU123456',
        department: 'Computer Science',
        metadata: { company: 'Tech Corp' },
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue(createSelectChain({ data: mockProfile, error: null })),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockProfile);
      expect(mockValidateOrganizer).toHaveBeenCalledWith('Bearer test-token');
    });

    it('should return 404 when profile is not found', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue(createSelectChain({ data: null, error: null })),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('NOT_FOUND');
    });

    it('should return 500 for GET server error', async () => {
      const mockSupabase = {
        from: jest.fn().mockReturnValue(createSelectChain({ data: null, error: { message: 'Database connection failed' } })),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await GET(createRequest('GET'));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('INTERNAL_ERROR');
    });
  });

  describe('PUT /api/organizer/profile', () => {
    it('should return 401 for unauthorized request', async () => {
      const response = await PUT(createRequest('PUT', { full_name: 'Jane Doe' }, { Authorization: '' }));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('UNAUTHORIZED');
    });

    it('should update profile successfully', async () => {
      const updatedProfile = {
        id: 'test-user-id',
        email: 'organizer@example.com',
        full_name: 'Jane Doe',
        phone: '+91 98765 43211',
        avatar_url: null,
        role: 'organizer',
        registration_number: null,
        department: null,
        metadata: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue(createUpdateChain({ data: updatedProfile, error: null })),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await PUT(createRequest('PUT', {
        full_name: 'Jane Doe',
        phone: '+91 98765 43211',
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.full_name).toBe('Jane Doe');
      expect(data.data.phone).toBe('+91 98765 43211');
    });

    it('should reject validation failures', async () => {
      const cases = [
        [{ full_name: '' }, 'Full name'],
        [{ full_name: 'A'.repeat(201) }, 'Full name'],
        [{ phone: 'A'.repeat(21) }, 'Phone number'],
        [{ registration_number: 'A'.repeat(51) }, 'Registration number'],
        [{ department: 'A'.repeat(101) }, 'Department'],
        [{ metadata: 'invalid' }, 'Metadata'],
      ] as const;

      for (const [body, expectedMessage] of cases) {
        const response = await PUT(createRequest('PUT', body));
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe('INVALID_DATA');
        expect(data.message).toContain(expectedMessage);
      }
    });

    it('should return 400 for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/organizer/profile', {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: '{ invalid json }',
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('INVALID_REQUEST');
    });

    it('should update only provided fields for partial update', async () => {
      let capturedUpdates: Record<string, unknown> | undefined;
      const updatedProfile = {
        id: 'test-user-id',
        email: 'organizer@example.com',
        full_name: 'Jane Doe',
        phone: '+91 98765 43211',
        avatar_url: null,
        role: 'organizer',
        registration_number: null,
        department: null,
        metadata: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue(
          createUpdateChain({ data: updatedProfile, error: null }, (value) => {
            capturedUpdates = value as Record<string, unknown>;
          })
        ),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await PUT(createRequest('PUT', {
        full_name: 'Jane Doe',
        phone: '+91 98765 43211',
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.full_name).toBe('Jane Doe');
      expect(data.data.phone).toBe('+91 98765 43211');
      expect(capturedUpdates).toMatchObject({
        full_name: 'Jane Doe',
        phone: '+91 98765 43211',
      });
      expect(capturedUpdates).not.toHaveProperty('metadata');
      expect(capturedUpdates).not.toHaveProperty('department');
      expect(capturedUpdates).not.toHaveProperty('registration_number');
    });

    it('should handle null fields correctly', async () => {
      let capturedUpdates: Record<string, unknown> | undefined;
      const updatedProfile = {
        id: 'test-user-id',
        email: 'organizer@example.com',
        full_name: null,
        phone: null,
        avatar_url: null,
        role: 'organizer',
        registration_number: null,
        department: null,
        metadata: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue(
          createUpdateChain({ data: updatedProfile, error: null }, (value) => {
            capturedUpdates = value as Record<string, unknown>;
          })
        ),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await PUT(createRequest('PUT', {
        full_name: null,
        phone: null,
      }));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.full_name).toBeNull();
      expect(data.data.phone).toBeNull();
      expect(capturedUpdates).toMatchObject({
        full_name: null,
        phone: null,
      });
    });

    it('should always set updated_at during update', async () => {
      let capturedUpdates: Record<string, unknown> | undefined;
      const updatedProfile = {
        id: 'test-user-id',
        email: 'organizer@example.com',
        full_name: 'Jane Doe',
        phone: null,
        avatar_url: null,
        role: 'organizer',
        registration_number: null,
        department: null,
        metadata: null,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockSupabase = {
        from: jest.fn().mockReturnValue(
          createUpdateChain({ data: updatedProfile, error: null }, (value) => {
            capturedUpdates = value as Record<string, unknown>;
          })
        ),
      };
      mockCreateServiceRoleClient.mockReturnValue(mockSupabase);

      const response = await PUT(createRequest('PUT', {
        full_name: 'Jane Doe',
      }));

      expect(response.status).toBe(200);
      expect(capturedUpdates?.updated_at).toBeDefined();
      expect(typeof capturedUpdates?.updated_at).toBe('string');
    });
  });
});
