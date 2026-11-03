import { IsString, IsOptional, IsInt, IsJSON } from 'class-validator';

export class CreateRoadmapNodeDto {
  @IsInt()
  @IsOptional()
  nodeNumber?: number;

  @IsString()
  title: string;

  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  learningObjectives?: any;

  @IsOptional()
  videos?: any;

  @IsOptional()
  officialDocs?: any;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  cheatsheet?: string;

  @IsOptional()
  codeExamples?: any;

  @IsOptional()
  quizQuestions?: any;

  @IsOptional()
  aiInterviewQuestions?: any;

  @IsOptional()
  codingChallenge?: any;

  @IsOptional()
  miniProject?: any;

  @IsOptional()
  validationRules?: any;

  @IsInt()
  @IsOptional()
  xpReward?: number;

  @IsInt()
  @IsOptional()
  coinsReward?: number;

  @IsOptional()
  skillMapping?: any;

  @IsOptional()
  evaluationConfig?: any;

  @IsOptional()
  careerDnaImpact?: any;

  @IsInt()
  @IsOptional()
  estimatedDurationMinutes?: number;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsOptional()
  prerequisites?: any;

  @IsString()
  @IsOptional()
  status?: string;
}

export class UpdateRoadmapNodeDto {
  // Launchpad Final Master Plan, Slice 7: optimistic concurrency. When supplied, update() only
  // applies if the node's current `version` still matches this value — otherwise it's a 409, not
  // a silent overwrite of someone else's concurrent edit. Optional so every other/pre-existing
  // caller of update() (and dto instances built without it) keeps working unchanged.
  @IsInt()
  @IsOptional()
  expectedVersion?: number;

  @IsInt()
  @IsOptional()
  nodeNumber?: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  learningObjectives?: any;

  @IsOptional()
  videos?: any;

  @IsOptional()
  officialDocs?: any;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  cheatsheet?: string;

  @IsOptional()
  codeExamples?: any;

  @IsOptional()
  quizQuestions?: any;

  @IsOptional()
  aiInterviewQuestions?: any;

  @IsOptional()
  codingChallenge?: any;

  @IsOptional()
  miniProject?: any;

  @IsOptional()
  validationRules?: any;

  @IsInt()
  @IsOptional()
  xpReward?: number;

  @IsInt()
  @IsOptional()
  coinsReward?: number;

  @IsOptional()
  skillMapping?: any;

  @IsOptional()
  evaluationConfig?: any;

  @IsOptional()
  careerDnaImpact?: any;

  @IsInt()
  @IsOptional()
  estimatedDurationMinutes?: number;

  @IsString()
  @IsOptional()
  difficulty?: string;

  @IsOptional()
  prerequisites?: any;

  @IsString()
  @IsOptional()
  status?: string;
}
