export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    roles?: string[];
    permissions?: string[];
    mustChangePassword?: boolean;
    userType?: string;
    emailVerified?: boolean;
    activeOrganizationId?: string | null;
  };
}

export class CurrentUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  roles?: string[];
  permissions?: string[];
  /** A new employee still on their one-time password: the app asks for a new one first. */
  mustChangePassword?: boolean;
  userType?: string;
  emailVerified?: boolean;
  activeOrganizationId?: string | null;
}
