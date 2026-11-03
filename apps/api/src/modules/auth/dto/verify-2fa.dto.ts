import { IsString, Length, IsOptional } from 'class-validator';

export class Verify2FADto {
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @IsOptional()
  @IsString()
  mfaSessionToken?: string;
}
