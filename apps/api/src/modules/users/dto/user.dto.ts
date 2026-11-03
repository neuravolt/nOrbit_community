export class UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  status: string;
  role?: string;
  roleId?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class ListUsersResponseDto {
  data: UserDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
