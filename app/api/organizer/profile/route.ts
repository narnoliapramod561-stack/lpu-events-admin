import { NextRequest, NextResponse } from 'next/server';
// NOTE: `validateOrganizer` will be required at runtime inside handlers
// so tests can mock the module before the route is loaded.
import { createClient } from '@supabase/supabase-js';
import { getServerEnv } from '@/lib/env';
import { validateOrganizer } from '@/lib/auth/organizer-guard';

/**
 * GET /api/organizer/profile
 * 
 * Fetch the current organizer's profile information.
 * Only accessible to organizers and super admins.
 * 
 * @returns Organizer profile data including id, email, full_name, phone, avatar_url, role, etc.
 */
export async function GET(request: NextRequest) {
  try {
    // Validate organizer authentication
    // Validate organizer authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const authResult = await validateOrganizer(authHeader);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    if (!authResult.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'User ID not found in token' },
        { status: 401 }
      );
    }

    const env = getServerEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const userId = authResult.user.id;

    // Fetch profile from database
    const { data: profile, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        full_name,
        phone,
        avatar_url,
        role,
        registration_number,
        department,
        metadata,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/organizer/profile:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organizer/profile
 * 
 * Update the current organizer's profile information.
 * Only accessible to organizers and super admins.
 * 
 * Request body:
 * - full_name: string | null
 * - phone: string | null
 * - avatar_url: string | null (optional, use file upload for actual image)
 * - registration_number: string | null
 * - department: string | null
 * - metadata: Record<string, any> | null
 * 
 * @returns Updated profile data
 */
export async function PUT(request: NextRequest) {
  try {
    // Validate organizer authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const authResult = await validateOrganizer(authHeader);
    if (authResult.status !== 200) {
      return NextResponse.json(
        { error: authResult.error, message: authResult.message },
        { status: authResult.status }
      );
    }

    if (!authResult.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'User ID not found in token' },
        { status: 401 }
      );
    }

    const env = getServerEnv();
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    const userId = authResult.user.id;

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    

    // Validate required fields if provided
    if (body.full_name !== undefined) {
      if (body.full_name === null) {
        // allowed: explicit null to clear the field
      } else if (typeof body.full_name === 'string') {
        const fullName = body.full_name.trim();
        if (fullName.length < 1 || fullName.length > 200) {
          return NextResponse.json(
            { error: 'INVALID_DATA', message: 'Full name must be between 1 and 200 characters' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'INVALID_DATA', message: 'Full name must be a string or null' },
          { status: 400 }
        );
      }
    }

    if (body.phone !== undefined) {
      if (body.phone === null) {
        // allowed
      } else if (typeof body.phone === 'string') {
        const phone = body.phone.trim();
        if (phone.length > 20) {
          return NextResponse.json(
            { error: 'INVALID_DATA', message: 'Phone number cannot exceed 20 characters' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'INVALID_DATA', message: 'Phone must be a string or null' },
          { status: 400 }
        );
      }
    }

    if (body.registration_number !== undefined) {
      if (body.registration_number === null) {
        // allowed
      } else if (typeof body.registration_number === 'string') {
        const regNumber = body.registration_number.trim();
        if (regNumber.length > 50) {
          return NextResponse.json(
            { error: 'INVALID_DATA', message: 'Registration number cannot exceed 50 characters' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'INVALID_DATA', message: 'Registration number must be a string or null' },
          { status: 400 }
        );
      }
    }

    if (body.department !== undefined) {
      if (body.department === null) {
        // allowed
      } else if (typeof body.department === 'string') {
        const dept = body.department.trim();
        if (dept.length > 100) {
          return NextResponse.json(
            { error: 'INVALID_DATA', message: 'Department cannot exceed 100 characters' },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'INVALID_DATA', message: 'Department must be a string or null' },
          { status: 400 }
        );
      }
    }

    if (body.metadata !== undefined && body.metadata !== null) {
      if (typeof body.metadata !== 'object' || Array.isArray(body.metadata)) {
        return NextResponse.json(
          { error: 'INVALID_DATA', message: 'Metadata must be an object' },
          { status: 400 }
        );
      }
    }

    // Prepare update object with validation
    const updates: Record<string, unknown> = {};

    if (body.full_name !== undefined) {
      if (body.full_name === null) {
        updates.full_name = null;
      } else {
        updates.full_name = (body.full_name as string).trim() || null;
      }
    }

    if (body.phone !== undefined) {
      if (body.phone === null) {
        updates.phone = null;
      } else {
        updates.phone = (body.phone as string).trim() || null;
      }
    }

    if (body.registration_number !== undefined) {
      if (body.registration_number === null) {
        updates.registration_number = null;
      } else {
        updates.registration_number = (body.registration_number as string).trim() || null;
      }
    }

    if (body.department !== undefined) {
      if (body.department === null) {
        updates.department = null;
      } else {
        updates.department = (body.department as string).trim() || null;
      }
    }

    if (body.metadata !== undefined) {
      updates.metadata = body.metadata;
    }

    // Ensure updated_at is always updated
    updates.updated_at = new Date().toISOString();

    // Update profile in database
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select(`
        id,
        email,
        full_name,
        phone,
        avatar_url,
        role,
        registration_number,
        department,
        metadata,
        is_active,
        created_at,
        updated_at
      `)
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'INTERNAL_ERROR', message: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Unexpected error in PUT /api/organizer/profile:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
