import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  IsIn,
  IsUrl,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContactPersonDto } from './contact-person.dto';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Please enter a valid website URL' })
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'PROSPECT', 'SUSPENDED'], {
    message: 'Status must be one of: ACTIVE, INACTIVE, PROSPECT, SUSPENDED',
  })
  status?: 'ACTIVE' | 'INACTIVE' | 'PROSPECT' | 'SUSPENDED';

  @IsOptional()
  @IsBoolean()
  collectEnabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactPersonDto)
  contacts?: ContactPersonDto[];
}
