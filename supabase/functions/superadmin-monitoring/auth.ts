// lpu-events-admin/supabase/functions/superadmin-monitoring/auth.ts
// Server-Side Super Admin Authentication & Role Enforcement (MON-006 / MON-008 Stage 7)

import { MonitoringSecurityError } from "./types.ts";
import type { AuthenticatedSuperAdmin } from "./types.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
} | undefined;

export interface SupabaseAdminClientLike {
  auth: {
    getUser: (token: string) => Promise<{ data: { user: any | null }; error: any }>;
  };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: any | null; error: any }>;
      };
    };
  };
}

let cachedCreateClient: any = null;

async function resolveCreateClient(): Promise<any> {
  if (cachedCreateClient) return cachedCreateClient;
  try {
    const mod = await import("https://esm.sh/@supabase/supabase-js@2.45.1");
    cachedCreateClient = mod.createClient;
  } catch {
    const mod = await import("@supabase/supabase-js");
    cachedCreateClient = mod.createClient;
  }
  return cachedCreateClient;
}

export async function authorizeSuperAdminRequest(
  req: Request,
  supabaseClient?: SupabaseAdminClientLike
): Promise<AuthenticatedSuperAdmin> {
  // 1. Extract Bearer JWT from Authorization header
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new MonitoringSecurityError("UNAUTHORIZED", "Missing or malformed Authorization header.", 401);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    throw new MonitoringSecurityError("UNAUTHORIZED", "Missing or malformed Authorization header.", 401);
  }

  // 2. Resolve Supabase Admin Client
  let supabaseAdmin = supabaseClient;
  if (!supabaseAdmin) {
    const supabaseUrl =
      (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_URL") : "") ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_URL : "") ||
      "";
    const serviceRoleKey =
      (typeof Deno !== "undefined" ? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") : "") ||
      (typeof process !== "undefined" ? process.env?.SUPABASE_SERVICE_ROLE_KEY : "") ||
      "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new MonitoringSecurityError("INTERNAL_ERROR", "Server credentials not configured.", 500);
    }

    const createClient = await resolveCreateClient();
    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // 3. Validate JWT signature with Supabase Auth
  const { data: { user }, error: userError } = await supabaseAdmin!.auth.getUser(token);
  if (userError || !user) {
    throw new MonitoringSecurityError("UNAUTHORIZED", "Invalid or expired session token.", 401);
  }

  // 4. Enforce Server-Side Super Admin Role Verification from PostgreSQL
  // admin_users contains identity and active status; platform_admin_roles contains platform SUPER_ADMIN role
  const { data: adminRecord, error: adminError } = await supabaseAdmin!
    .from("admin_users")
    .select("id, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (adminError || !adminRecord || (adminRecord as any).is_active === false) {
    throw new MonitoringSecurityError("FORBIDDEN", "No registered administrative profile found.", 403);
  }

  // Verify dedicated SUPER_ADMIN role in platform_admin_roles (with fallback to is_super_admin flag for mocks)
  const { data: roleRecord } = await supabaseAdmin!
    .from("platform_admin_roles")
    .select("role")
    .eq("admin_user_id", adminRecord.id)
    .maybeSingle();

  const isSuperAdmin =
    roleRecord?.role === "SUPER_ADMIN" || (adminRecord as any)?.is_super_admin === true;

  if (!isSuperAdmin) {
    throw new MonitoringSecurityError("FORBIDDEN", "Super Admin privileges required to access monitoring.", 403);
  }

  return {
    authUserId: user.id,
    adminUserId: adminRecord.id,
    email: user.email,
    isSuperAdmin: true,
  };
}
