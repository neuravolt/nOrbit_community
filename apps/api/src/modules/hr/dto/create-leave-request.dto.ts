import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsUUID,
  IsOptional,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { LeaveType, LeaveDurationType, HalfDaySlot } from '@prisma/client';

export class CreateLeaveRequestDto {
  @IsNotEmpty()
  @IsUUID(4, { message: 'Employee ID must be a valid UUID' })
  employeeId: string;

  @IsNotEmpty()
  @IsEnum(LeaveType, { message: 'Invalid leave type' })
  leaveType: LeaveType;

  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @IsNotEmpty()
  @IsDateString()
  endDate: string;

  @IsOptional()
  @IsEnum(LeaveDurationType)
  durationType?: LeaveDurationType;

  @IsOptional()
  @IsEnum(HalfDaySlot)
  halfDaySlot?: HalfDaySlot;

  @IsOptional()
  @IsNumber()
  hoursRequested?: number;

  @IsNotEmpty()
  @IsString()
  reason: string;
}

export class UpdateLeaveStatusDto {
  @IsNotEmpty()
  @IsEnum(['APPROVED', 'REJECTED', 'CANCELLED'])
  status: 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @IsOptional()
  @IsString()
  remarks?: string;
}
