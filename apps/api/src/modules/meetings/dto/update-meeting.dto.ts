import {
  IsOptional,
  IsString,
  IsUrl,
  IsDateString,
  Matches,
  IsEnum,
} from 'class-validator';
import { MeetingStatus } from '@prisma/client';

export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  meetingDate?: string;

  @IsOptional()
  @Matches(/^https?:\/\/.+$/, {
    message: 'Google Meet URL must be a valid HTTP or HTTPS URL',
  })
  meetingUrl?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 numeric digits' })
  pin?: string;

  @IsOptional()
  @IsEnum(MeetingStatus)
  status?: MeetingStatus;
}
