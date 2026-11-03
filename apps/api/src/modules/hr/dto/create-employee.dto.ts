import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { RoleField, EmploymentType, EmployeeStatus } from '@prisma/client';

export class CreateEmployeeDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional()
  @IsEnum(RoleField)
  role?: RoleField;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsEnum(EmploymentType)
  employmentType?: EmploymentType;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dateOfBirth?: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  personalEmail?: string;

  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  alternateMobile?: string;

  @IsOptional()
  @IsString()
  emergencyContactName?: string;

  @IsOptional()
  @IsString()
  emergencyContactNumber?: string;

  @IsOptional()
  @IsString()
  relationship?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  noticePeriodDays?: number | string;

  @IsOptional()
  @IsString()
  costCenter?: string;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsString()
  reportingManager?: string;

  @IsOptional()
  @IsString()
  workLocation?: string;

  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @IsOptional()
  @IsString()
  addressJson?: string;

  @IsOptional()
  @IsString()
  governmentIdsJson?: string;

  @IsOptional()
  @IsString()
  bankDetailsJson?: string;

  @IsOptional()
  @IsString()
  bankHolderName?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsString()
  bankIfscCode?: string;

  @IsOptional()
  @IsString()
  bankBranchName?: string;

  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  pranNumber?: string;

  @IsOptional()
  @IsString()
  attendanceSettingsJson?: string;

  @IsOptional()
  @IsString()
  leaveSettingsJson?: string;

  @IsOptional()
  @IsString()
  assetsJson?: string;

  @IsOptional()
  @IsString()
  educationJson?: string;

  @IsOptional()
  @IsString()
  experienceJson?: string;

  @IsOptional()
  @IsString()
  skillsJson?: string;

  @IsOptional()
  @IsString()
  documentsJson?: string;

  @IsOptional()
  ctc?: number | string;

  @IsOptional()
  basicSalary?: number | string;

  @IsOptional()
  hra?: number | string;

  @IsOptional()
  allowance?: number | string;

  @IsOptional()
  pfApplicable?: boolean | string;

  @IsOptional()
  esiApplicable?: boolean | string;

  @IsOptional()
  @IsString()
  salaryCycle?: string;

  @IsOptional()
  @IsString()
  paymentMode?: string;

  @IsOptional()
  professionalTax?: number | string;

  @IsOptional()
  tds?: number | string;

  @IsOptional()
  @IsString()
  exitDate?: string;

  @IsOptional()
  @IsString()
  exitReason?: string;

  @IsOptional()
  @IsString()
  exitInterviewNotes?: string;

  @IsOptional()
  ffSettled?: boolean | string;
}
