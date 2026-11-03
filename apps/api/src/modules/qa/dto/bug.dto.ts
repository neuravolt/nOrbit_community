import { IsString, IsOptional } from 'class-validator';

export class CreateBugReportDto {
  @IsString()
  projectId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  stepsToReproduce?: string;

  @IsOptional()
  @IsString()
  expectedResult?: string;

  @IsOptional()
  @IsString()
  actualResult?: string;

  @IsString()
  severity: string; // critical/high/medium/low

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  testCaseId?: string;
}

export class UpdateBugReportDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  stepsToReproduce?: string;

  @IsOptional()
  @IsString()
  expectedResult?: string;

  @IsOptional()
  @IsString()
  actualResult?: string;

  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  assignedToId?: string;

  @IsOptional()
  @IsString()
  testCaseId?: string;
}

export class UpdateBugStatusDto {
  @IsString()
  status: string; // new/in_progress/fixed/verified/closed
}

export class AssignBugDto {
  @IsString()
  assignedToId: string;
}

export class ListBugsQuery {
  projectId?: string;
  status?: string;
  severity?: string;
  assigneeId?: string;
}
