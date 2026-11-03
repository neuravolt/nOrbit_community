import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BundleServiceItemDto {
  @IsString()
  serviceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  qty: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;
}

export class CreateServiceDto {
  @IsString()
  serviceCode: string;

  @IsString()
  category: string;

  @IsString()
  subCategory: string;

  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  unitType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gstRate?: number;
}

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unitType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  gstRate?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpsertRateCardDto {
  @IsString()
  serviceId: string;

  @IsString()
  clientTier: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  customPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  discountPercent?: number;
}

export class CreateBundleDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleServiceItemDto)
  services: BundleServiceItemDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalPrice: number;
}
