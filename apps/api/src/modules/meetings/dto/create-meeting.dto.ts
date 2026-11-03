import {
  IsNotEmpty,
  IsString,
  IsUrl,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateMeetingDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsDateString()
  meetingDate: string;

  @IsNotEmpty()
  @Matches(/^https?:\/\/.+$/, {
    message: 'Google Meet URL must be a valid HTTP or HTTPS URL',
  })
  meetingUrl: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 numeric digits' })
  pin: string;
}
