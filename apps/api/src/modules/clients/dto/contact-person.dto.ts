import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
} from 'class-validator';

export class ContactPersonDto {
  @IsString()
  @MinLength(1, { message: 'Contact name cannot be empty' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Contact email must be a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @IsBoolean()
  isPrimary: boolean;
}
