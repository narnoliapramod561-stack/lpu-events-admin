import { NextResponse, type NextRequest } from 'next/server';

import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

async function handleSignOut(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  // Sign out from Supabase Auth
  await supabase.auth.signOut();

  // Redirect to sign-in page
  const redirectUrl = new URL('/auth/sign-in', request.url);
  return NextResponse.redirect(redirectUrl, {
    status: 302,
  });
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}
