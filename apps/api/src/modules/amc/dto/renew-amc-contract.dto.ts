import { IsDateString, IsOptional, IsBoolean, IsNumber } from 'class-validator';

export class RenewAmcContractDto {
  @IsDateString()
  newEndDate: Date;

  @IsOptional()
  @IsBoolean()
  resetHours?: boolean;

  @IsOptional()
  @IsNumber()
  newTotalHours?: number;
}
