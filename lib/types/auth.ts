export type UserRole = 'student' | 'organizer' | 'super_admin' | 'admin';

export type AuthUserProfile = {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
  fullName: string | null;
  avatarUrl: string | null;
  status: string;
};
