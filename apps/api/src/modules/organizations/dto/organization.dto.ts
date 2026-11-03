import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { OrganizationRole } from '@prisma/client';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  domain?: string;
}

export class InviteMemberDto {
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email!: string;

  @IsEnum(OrganizationRole, {
    message: 'Role must be OWNER, ADMIN, MEMBER, or VIEWER',
  })
  @IsOptional()
  role?: OrganizationRole;
}

export class UpdateMemberRoleDto {
  @IsEnum(OrganizationRole, {
    message: 'Role must be OWNER, ADMIN, MEMBER, or VIEWER',
  })
  @IsNotEmpty()
  role!: OrganizationRole;
}
