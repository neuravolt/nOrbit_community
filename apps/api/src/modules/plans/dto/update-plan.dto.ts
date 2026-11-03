import {
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  Min,
} from 'class-validator';

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceMonthlyINR?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceYearlyINR?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceMonthlyUSD?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  priceYearlyUSD?: number;

  @IsNumber()
  @IsOptional()
  maxMembers?: number;

  @IsNumber()
  @IsOptional()
  maxProjects?: number;

  @IsNumber()
  @IsOptional()
  maxServers?: number;

  @IsBoolean()
  @IsOptional()
  featureProjectsTasks?: boolean;

  @IsBoolean()
  @IsOptional()
  featureCrm?: boolean;

  @IsBoolean()
  @IsOptional()
  featureBilling?: boolean;

  @IsBoolean()
  @IsOptional()
  featureGuardianByovps?: boolean;

  @IsBoolean()
  @IsOptional()
  featureClientPortal?: boolean;

  @IsBoolean()
  @IsOptional()
  featureApiAccess?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
