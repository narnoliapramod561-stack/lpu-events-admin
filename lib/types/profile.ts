export interface Profile {
  id: string;
  email?: string | null;
  displayName?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  role?: string | null;
}

export default Profile;
