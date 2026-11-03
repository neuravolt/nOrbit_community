export type NodeStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "quiz_completed"
  | "challenge_completed"
  | "ai_verified"
  | "mentor_approved"
  | "completed";

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type AgentType =
  | "planner"
  | "content"
  | "quiz"
  | "challenge"
  | "interview"
  | "validation"
  | "github";

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "retrying";

export interface Career {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CareerRole {
  id: string;
  careerId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Technology {
  id: string;
  careerRoleId: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  defaultStack: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface TechnologyLevel {
  id: string;
  technologyId: string;
  levelNumber: number;
  name: string;
  description?: string;
  xpRequired: number;
  estimatedDurationHours: number;
  difficulty: Difficulty;
  sortOrder: number;
  isActive: boolean;
}

export interface RoadmapNode {
  id: string;
  technologyLevelId: string;
  nodeNumber: number;
  title: string;
  slug: string;
  description?: string;
  learningObjectives?: any;
  videos?: any;
  officialDocs?: any;
  notes?: string;
  cheatsheet?: string;
  codeExamples?: any;
  quizQuestions?: any;
  aiInterviewQuestions?: any;
  codingChallenge?: any;
  miniProject?: any;
  validationRules?: any;
  xpReward: number;
  coinsReward: number;
  skillMapping?: any;
  careerDnaImpact?: any;
  estimatedDurationMinutes: number;
  difficulty: Difficulty;
  prerequisites?: string[];
  status: string;
  version: number;
  createdBy?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudentTechnologyProgress {
  id: string;
  studentId: string;
  technologyId: string;
  currentLevel: number;
  currentNode: number;
  overallProgressPercent: number;
  masteryScore: number;
  status: string;
  startedAt?: string;
  completedAt?: string;
  lastActivityAt: string;
}

export interface StudentNodeProgress {
  id: string;
  studentId: string;
  nodeId: string;
  status: NodeStatus;
  quizScore?: number;
  challengeSubmissionUrl?: string;
  aiReviewScore?: number;
  aiReviewFeedback?: string;
  mentorReviewStatus?: string;
  mentorReviewNotes?: string;
  evidenceId?: string;
  xpAwarded?: number;
  coinsAwarded?: number;
  startedAt: string;
  quizCompletedAt?: string;
  challengeSubmittedAt?: string;
  aiVerifiedAt?: string;
  mentorApprovedAt?: string;
  completedAt?: string;
}

export interface AIPrompt {
  id: string;
  name: string;
  agentType: AgentType;
  promptTemplate: string;
  modelConfig: any;
  outputSchema?: any;
  isActive: boolean;
  version: number;
}

export interface AIGenerationJob {
  id: string;
  jobType: string;
  status: JobStatus;
  targetType: string;
  targetId: string;
  bullmqJobId?: string;
  inputData: any;
  outputData?: any;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  reviewStatus?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface GitHubRoadmapRepo {
  id: string;
  nodeId: string;
  projectId: string;
  repoName: string;
  repoUrl: string;
  orgName: string;
  templateRepo: string;
  defaultBranch: string;
  hasProtectedBranches: boolean;
  issuesGenerated: boolean;
  milestonesGenerated: boolean;
  status: string;
}
