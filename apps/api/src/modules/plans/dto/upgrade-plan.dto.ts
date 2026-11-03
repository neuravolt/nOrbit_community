import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class UpgradePlanDto {
  @IsString()
  @IsNotEmpty()
  planId: string;

  @IsString()
  @IsIn(['MONTHLY', 'YEARLY'])
  billingInterval: 'MONTHLY' | 'YEARLY';

  @IsString()
  @IsOptional()
  @IsIn(['INR', 'USD'])
  currency?: 'INR' | 'USD';
}
