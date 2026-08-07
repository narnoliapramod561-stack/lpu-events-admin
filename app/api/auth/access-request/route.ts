import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const requestSchema = z.object({
  organisation: z.string().min(2).max(200),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parseResult = requestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { organisation } = parseResult.data;

    // Check if user already has an organizer application
    const { data: existingApplication } = await supabase
      .from('organizer_applications')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingApplication) {
      if (existingApplication.status === 'pending') {
        return NextResponse.json(
          { error: 'ALREADY_PENDING', message: 'You already have a pending access request' },
          { status: 409 }
        );
      }
      if (existingApplication.status === 'approved') {
        return NextResponse.json(
          { error: 'ALREADY_APPROVED', message: 'You already have organizer access' },
          { status: 409 }
        );
      }
      if (existingApplication.status === 'rejected') {
        return NextResponse.json(
          { error: 'ALREADY_REJECTED', message: 'Your previous access request was rejected' },
          { status: 409 }
        );
      }
    }

    // Create the organizer application
    const { error: insertError } = await supabase
      .from('organizer_applications')
      .insert({
        user_id: user.id,
        organization_name: organisation,
        description: 'Organizer access request',
        status: 'pending',
      });

    if (insertError) {
      console.error('Error creating access request:', insertError);
      return NextResponse.json(
        { error: 'DATABASE_ERROR', message: 'Failed to submit access request' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Access request submitted successfully' },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in access request API:', error);
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}