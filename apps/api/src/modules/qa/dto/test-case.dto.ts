import { IsString, IsOptional } from 'class-validator';

export class CreateTestCaseDto {
  @IsString()
  projectId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  steps: string;

  @IsString()
  expectedResult: string;
}

export class UpdateTestCaseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  steps?: string;

  @IsOptional()
  @IsString()
  expectedResult?: string;
}

export class RecordTestCaseRunDto {
  @IsString()
  status: string; // pass/fail
}
