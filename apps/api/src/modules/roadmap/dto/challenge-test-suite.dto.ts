import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsNumber,
  MinLength,
} from 'class-validator';

// Phase 2 (Hidden Tests): admin-authored content for ChallengeTestSuite. `stage` is deliberately
// not exposed here — every row created through this DTO is hard-pinned to stage: 'test', the only
// value unit-tests.validator.ts ever reads (schema.prisma documents 'build'/'security'/'lint'/
// 'ai_review' as allowed values too, but nothing in the codebase consumes them — scoping this DTO
// to what Phase 2 actually builds, not the unused rest of the column's domain).
export class CreateChallengeTestSuiteDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @MinLength(1)
  testCode: string;

  @IsInt()
  @IsOptional()
  timeoutSec?: number;

  @IsInt()
  @IsOptional()
  points?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @IsOptional()
  weight?: number;
}

export class UpdateChallengeTestSuiteDto {
  @IsString()
  @MinLength(1)
  @IsOptional()
  name?: string;

  @IsString()
  @MinLength(1)
  @IsOptional()
  testCode?: string;

  @IsInt()
  @IsOptional()
  timeoutSec?: number;

  @IsInt()
  @IsOptional()
  points?: number;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsNumber()
  @IsOptional()
  weight?: number;
}
