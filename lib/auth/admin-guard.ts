import { supabaseAdmin } from '@/lib/supabase';

export async function validateSuperAdmin(authToken: string) {
  const supabase = supabaseAdmin;

  let user = null;

  // Try getting user by ID first if it looks like a UUID
  if (authToken && authToken.includes('-')) {
    const { data: { user: adminUser }, error: adminError } = await supabase.auth.getUser(authToken);
    if (!adminError && adminUser) {
      user = adminUser;
    }
  }

  // Fallback to getUser with token
  if (!user) {
    const { data: { user: tokenUser }, error: tokenError } = await supabase.auth.getUser(authToken);
    if (!tokenError && tokenUser) {
      user = tokenUser;
    }
  }

  if (!user) {
    return {
      status: 401,
      error: 'UNAUTHORIZED',
      message: 'Authentication failed. Invalid token.',
    };
  }

  // Check if user is the Super Admin
  if (user.email !== 'subhamkumar16072006@gmail.com') {
    return {
      status: 403,
      error: 'FORBIDDEN',
      message: 'Access denied. Only Super Admin is allowed here.',
    };
  }

  return {
    status: 200,
    message: 'Authorized',
    user: {
      id: user.id,
      email: user.email,
      role: 'super_admin',
    },
  };
}