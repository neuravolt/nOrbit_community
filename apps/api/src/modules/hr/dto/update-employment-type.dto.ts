import { IsEnum, IsNotEmpty } from 'class-validator';
import { EmploymentType } from '@prisma/client';

export class UpdateEmploymentTypeDto {
  @IsNotEmpty()
  @IsEnum(EmploymentType, {
    message: 'Employment type must be EMPLOYEE, PAID_INTERN, or UNPAID_INTERN',
  })
  employmentType: EmploymentType;
}
