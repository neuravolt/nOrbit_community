import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsOptional,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { AttendanceStatus } from '@prisma/client';

export class LogAttendanceDto {
  @IsNotEmpty()
  @IsUUID(4, { message: 'Employee ID must be a valid UUID' })
  employeeId: string;

  @IsNotEmpty()
  @IsDateString()
  date: string; // Format: YYYY-MM-DD

  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @IsNotEmpty()
  @IsEnum(AttendanceStatus, { message: 'Invalid attendance status' })
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Where the punch was made (browser location), checked against the office geofence. */
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsNumber()
  accuracyMeters?: number;
}
