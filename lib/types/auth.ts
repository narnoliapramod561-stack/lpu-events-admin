export type UserRole = 'student' | 'organizer' | 'super_admin' | 'admin' | 'pending';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type AuthUserProfile = {
  id: string;
  email: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  isActive: boolean;
  displayName: string;
  fullName: string | null;
  avatarUrl: string | null;
  status: string;
};

// Re-export admin auth types for backward compatibility
export type { 
  AdminUserRole, 
  AdminUserStatus, 
  AccessRequestStatus,
  AdminUser,
  AdminAccessRequest,
  AuditLog 
} from './admin-auth';
