import { IsString, IsOptional, IsInt, IsBoolean, IsIn } from 'class-validator';

export class CreateTechnologyLevelDto {
  @IsInt()
  @IsOptional()
  levelNumber?: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  xpRequired?: number;

  @IsInt()
  @IsOptional()
  estimatedDurationHours?: number;

  @IsString()
  // Real data (React/Node.js's own Levels) uses a 4-tier scale — 'explorer' and 'professional'
  // exist on live rows today, seeded outside this DTO's validation, which only ever allowed 3
  // tiers. A manual edit through this same form on one of those rows would have been rejected by
  // this exact check. "Suggest Levels via AI" also proposes 'professional' for capstone-style
  // Levels, so this must accept it too.
  @IsIn([
    'beginner',
    'explorer',
    'intermediate',
    'advanced',
    'expert',
    'professional',
  ])
  difficulty: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateTechnologyLevelDto {
  @IsInt()
  @IsOptional()
  levelNumber?: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @IsOptional()
  xpRequired?: number;

  @IsInt()
  @IsOptional()
  estimatedDurationHours?: number;

  @IsString()
  @IsOptional()
  // Real data (React/Node.js's own Levels) uses a 4-tier scale — 'explorer' and 'professional'
  // exist on live rows today, seeded outside this DTO's validation, which only ever allowed 3
  // tiers. A manual edit through this same form on one of those rows would have been rejected by
  // this exact check. "Suggest Levels via AI" also proposes 'professional' for capstone-style
  // Levels, so this must accept it too.
  @IsIn([
    'beginner',
    'explorer',
    'intermediate',
    'advanced',
    'expert',
    'professional',
  ])
  difficulty?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
