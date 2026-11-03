import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  ValidateNested,
  MinLength,
  MaxLength,
  IsUrl,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContactPersonDto } from './contact-person.dto';

export class CreateClientDto {
  @IsString()
  @MinLength(1, { message: 'Client name is required' })
  @MaxLength(200, { message: 'Client name must be under 200 characters' })
  name: string;

  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number must be under 20 characters' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  state?: string;

  @IsOptional()
  @IsUrl(
    {},
    { message: 'Please enter a valid website URL (e.g. https://example.com)' },
  )
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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactPersonDto)
  contacts?: ContactPersonDto[];
}
