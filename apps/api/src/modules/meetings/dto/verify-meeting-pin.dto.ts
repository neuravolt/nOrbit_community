import { IsNotEmpty, IsString, Matches, IsOptional } from 'class-validator';

export class VerifyMeetingPinDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 numeric digits' })
  pin: string;
}

export class JoinMeetingDto {
  @IsNotEmpty()
  @IsString()
  token: string;
}

export class ListMeetingsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 20;
}
