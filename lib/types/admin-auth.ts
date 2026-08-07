export type AdminUserRole = 'organizer' | 'admin' | 'super_admin';
export type AdminUserStatus = 'approved' | 'disabled';
export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AdminUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  role: AdminUserRole;
  status: AdminUserStatus;
  is_active: boolean;
  approved_at: string | null;
  approved_by: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminAccessRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  organisation: string | null;
  custom_message: string | null;
  status: AccessRequestStatus;
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  admin_user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AdminAuthContext {
  user: {
    id: string;
    email: string;
  };
  adminUser: AdminUser;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOrganizer: boolean;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}