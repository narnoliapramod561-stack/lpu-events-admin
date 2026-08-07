import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * Admin API Guard - Protects admin API endpoints
 *
 * This guard ensures that only authenticated and authorized admin users
 * can access protected admin API endpoints.
 *
 * Usage:
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const guardResult = await adminApiGuard(request);
 *   if (guardResult.error) {
 *     return guardResult.response;
 *   }
 *   // Proceed with your API logic
 * }
 * ```
 */
export async function adminApiGuard(request: NextRequest) {
  try {
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser();

    if (authError || !user) {
      return {
        error: 'UNAUTHORIZED',
        response: NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Authentication required' },
          { status: 401 }
        ),
      };
    }

    // Super Admin check
    if (user.email === 'subhamkumar16072006@gmail.com') {
      return {
        error: null,
        response: null,
        user,
        isSuperAdmin: true,
      };
    }

    // Check if user is an authorized organizer
    const { data: organizerApplication } = await supabaseAdmin
      .from('organizer_applications')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .single();

    if (!organizerApplication) {
      return {
        error: 'FORBIDDEN',
        response: NextResponse.json(
          { error: 'FORBIDDEN', message: 'Access denied' },
          { status: 403 }
        ),
      };
    }

    return {
      error: null,
      response: null,
      user,
      isSuperAdmin: false,
    };
  } catch (error) {
    console.error(error);
    return {
      error: 'INTERNAL_SERVER_ERROR',
      response: NextResponse.json(
        { error: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' },
        { status: 500 }
      ),
    };
  }
}

/**
 * Super Admin API Guard - Protects super admin only API endpoints
 *
 * This guard ensures that only the Super Admin can access protected endpoints.
 */
export async function superAdminApiGuard(request: NextRequest) {
  const guardResult = await adminApiGuard(request);

  if (guardResult.error) {
    return guardResult;
  }

  if (!guardResult.isSuperAdmin) {
    return {
      error: 'FORBIDDEN',
      response: NextResponse.json(
        { error: 'FORBIDDEN', message: 'Super admin access required' },
        { status: 403 }
      ),
    };
  }

  return guardResult;
}