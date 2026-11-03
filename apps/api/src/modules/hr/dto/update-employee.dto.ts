import { CreateEmployeeDto } from './create-employee.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateEmployeeDto extends CreateEmployeeDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
