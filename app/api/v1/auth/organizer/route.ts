import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getUserRoleFromClient } from '@/lib/auth';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

const organizerAuthSchema = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('otp'),
    email: z.string().email(),
  }),
  z.object({
    method: z.literal('verify_otp'),
    email: z.string().email(),
    token: z.string().min(6).max(6),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parseResult = organizerAuthSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid organizer authentication request payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const payload = parseResult.data;
    const supabase = await createServerSupabaseClient();

    if (payload.method === 'otp') {
      // Dispatches OTP to organizer. shouldCreateUser: false prevents unauthorized student self-registration via organizer portal.
      const { error } = await supabase.auth.signInWithOtp({
        email: payload.email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json(
        { message: '6-digit OTP code sent successfully to organizer email' },
        { status: 200 }
      );
    }

    if (payload.method === 'verify_otp') {
      const { data, error } = await supabase.auth.verifyOtp({
        email: payload.email,
        token: payload.token,
        type: 'email',
      });

      if (error || !data.session || !data.user) {
        return NextResponse.json(
          { error: error?.message || 'Invalid or expired OTP token' },
          { status: 401 }
        );
      }

      // Role Pre-Check: Inspect profiles table to verify user has organizer or super_admin privileges
      const role = await getUserRoleFromClient(supabase);

      if (role !== 'organizer' && role !== 'super_admin' && role !== 'admin') {
        // Sign out temporary session to prevent unauthorized access
        await supabase.auth.signOut();

        return NextResponse.json(
          {
            error: 'Organizer application required',
            message:
              'Your account does not have approved organizer privileges. Please submit an organizer application.',
          },
          { status: 403 }
        );
      }

      const response = NextResponse.json(
        {
          message: 'Organizer authenticated successfully',
          user: data.user,
          role,
        },
        { status: 200 }
      );

      return response;
    }

    return NextResponse.json({ error: 'Unsupported authentication method' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}