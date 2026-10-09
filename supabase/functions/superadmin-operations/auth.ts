// supabase/functions/superadmin-operations/auth.ts
// Strict Super Admin Authentication & Authorization Verification Gateway

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.1";
import { OperationsError } from "./errors.ts";

export interface AuthenticatedSuperAdmin {
  authUserId: string;
  adminUserId: string;
  email: string;
  displayName: string;
  role: 'SUPER_ADMIN';
}

/**
 * Validates the incoming Authorization bearer token and verifies that the identity
 * corresponds to an active administrator with platform-level SUPER_ADMIN privileges.
 * 
 * Strict boundary invariants:
 * 1. Missing or malformed Authorization header -> 401 UNAUTHENTICATED
 * 2. Invalid or expired Supabase Auth token -> 401 UNAUTHENTICATED
 * 3. User not in admin_users or is_active = false -> 403 FORBIDDEN
 * 4. User role is not SUPER_ADMIN (e.g. ORGANIZER or unapproved) -> 403 FORBIDDEN
 * 5. Does NOT depend on student accounts or student tables.
 */
export async function verifySuperAdmin(
  req: Request,
  supabase: SupabaseClient
): Promise<AuthenticatedSuperAdmin> {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    throw new OperationsError(
      "UNAUTHENTICATED",
      "Missing or invalid Authorization header. Bearer token required.",
      401
    );
  }

  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!jwt) {
    throw new OperationsError(
      "UNAUTHENTICATED",
      "Empty bearer token supplied.",
      401
    );
  }

  // 1. Verify JWT signature and resolve Auth identity
  const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

  if (authError || !user) {
    throw new OperationsError(
      "UNAUTHENTICATED",
      "Invalid or expired session token.",
      401
    );
  }

  // 2. Resolve administrative user record
  const { data: adminUser, error: adminUserError } = await supabase
    .from("admin_users")
    .select("id, email, display_name, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (adminUserError) {
    throw new OperationsError(
      "INTERNAL_ERROR",
      "Failed to query administrative identity.",
      500
    );
  }

  if (!adminUser || !adminUser.is_active) {
    throw new OperationsError(
      "FORBIDDEN",
      "Access denied: Active administrative account required.",
      403
    );
  }

  // 3. Verify dedicated SUPER_ADMIN platform role
  const { data: platformRole, error: roleError } = await supabase
    .from("platform_admin_roles")
    .select("role")
    .eq("admin_user_id", adminUser.id)
    .maybeSingle();

  if (roleError) {
    throw new OperationsError(
      "INTERNAL_ERROR",
      "Failed to query administrative authorization roles.",
      500
    );
  }

  if (!platformRole || platformRole.role !== "SUPER_ADMIN") {
    throw new OperationsError(
      "FORBIDDEN",
      "Access denied: Super Administrator privilege required. Organizers and standard accounts are prohibited.",
      403
    );
  }

  return {
    authUserId: user.id,
    adminUserId: adminUser.id,
    email: adminUser.email || user.email || "",
    displayName: adminUser.display_name || "Super Admin",
    role: "SUPER_ADMIN",
  };
}
