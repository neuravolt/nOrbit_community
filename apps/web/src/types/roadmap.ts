// ============================================================
// Roadmap Engine — Centralized TypeScript Types
// All interfaces match the Prisma schema + API responses
// ============================================================

// ── Enums ────────────────────────────────────────────────────
export type Difficulty = "beginner" | "intermediate" | "advanced";

export type NodeStatus =
  | "locked"
  | "available"
  | "in_progress"
  | "quiz_completed"
  | "challenge_completed"
  | "ai_verified"
  | "peer_review_pending"
  | "mentor_approved"
  | "completed";

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

export type AgentType =
  | "roadmap_planner"
  | "content_generator"
  | "quiz_generator"
  | "challenge_generator"
  | "code_reviewer"
  | "github_readme_generator";

export type ReviewStatus = "pending" | "approved" | "rejected";

// ── Career & Role ─────────────────────────────────────────────
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
  roles?: CareerRole[];
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
  createdAt: string;
  updatedAt: string;
  career?: Career;
  technologies?: Technology[];
}

// ── Technology & Levels ───────────────────────────────────────
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
  createdAt: string;
  updatedAt: string;
  careerRole?: CareerRole;
  levels?: TechnologyLevel[];
}

export interface TechnologyLevel {
  id: string;
  technologyId: string;
  levelNumber: number;
  name?: string;
  description?: string;
  xpRequired: number;
  estimatedDurationHours?: number;
  difficulty: Difficulty;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  technology?: Technology;
  nodes?: RoadmapNode[];
  _count?: { nodes: number };
}

// ── Roadmap Node ──────────────────────────────────────────────
export interface RoadmapNode {
  id: string;
  technologyLevelId: string;
  nodeNumber: number;
  title: string;
  slug: string;
  description?: string;
  learningObjectives?: string[];
  videos?: VideoItem[];
  officialDocs?: DocItem[];
  notes?: string;
  cheatsheet?: string;
  codeExamples?: CodeExample[];
  quizQuestions?: QuizQuestion[];
  aiInterviewQuestions?: any[];
  codingChallenge?: CodingChallenge;
  miniProject?: MiniProject;
  validationRules?: any;
  xpReward: number;
  coinsReward: number;
  skillMapping?: Record<string, number>;
  careerDnaImpact?: Record<string, number>;
  estimatedDurationMinutes: number;
  difficulty: Difficulty;
  prerequisites?: string[];
  status: "draft" | "review" | "published" | "archived";
  version: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  level?: TechnologyLevel;
  // Student progress context (when fetched as student)
  progress?: StudentNodeProgress;
}

export interface VideoItem {
  title: string;
  url: string;
  duration?: string;
  platform?: string;
}

export interface DocItem {
  title: string;
  url: string;
  description?: string;
}

export interface CodeExample {
  title: string;
  language: string;
  code: string;
  explanation?: string;
}

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctAnswer: 0 | 1 | 2 | 3;
  explanation?: string;
  difficulty?: Difficulty;
}

export interface CodingChallenge {
  title: string;
  description: string;
  starterCode?: string;
  requirements?: string[];
  hiddenTests?: any[];
  validationRules?: any;
}

export interface MiniProject {
  title: string;
  description: string;
  requirements?: string[];
  deliverables?: string[];
}

// ── Student Progress ──────────────────────────────────────────
export interface StudentTechnologyProgress {
  id: string;
  studentId: string;
  technologyId: string;
  currentLevel: number;
  currentNode: number;
  overallProgressPercent: number;
  masteryScore: number;
  status: "not_started" | "in_progress" | "completed";
  startedAt?: string;
  completedAt?: string;
  lastActivityAt?: string;
  createdAt: string;
  updatedAt: string;
  technology?: Technology;
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
  mentorReviewStatus?: "pending" | "approved" | "rejected";
  mentorReviewNotes?: string;
  evidenceId?: string;
  xpAwarded: number;
  coinsAwarded: number;
  startedAt?: string;
  quizCompletedAt?: string;
  challengeSubmittedAt?: string;
  aiVerifiedAt?: string;
  mentorApprovedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── AI Prompt & Generation Job ────────────────────────────────
export interface AIPrompt {
  id: string;
  name: string;
  agentType: AgentType;
  promptTemplate: string;
  modelConfig?: Record<string, any>;
  outputSchema?: Record<string, any>;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIGenerationJob {
  id: string;
  jobType: string;
  status: JobStatus;
  targetType?: string;
  targetId?: string;
  bullmqJobId?: string;
  inputData?: Record<string, any>;
  outputData?: Record<string, any>;
  errorMessage?: string;
  retryCount: number;
  maxRetries: number;
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── GitHub Roadmap Repo ───────────────────────────────────────
export interface GitHubRoadmapRepo {
  id: string;
  nodeId?: string;
  projectId?: string;
  repoName: string;
  repoUrl: string;
  orgName?: string;
  templateRepo?: string;
  defaultBranch: string;
  hasProtectedBranches: boolean;
  issuesGenerated?: any[];
  milestonesGenerated?: any[];
  status: "creating" | "ready" | "failed";
  createdAt: string;
  updatedAt: string;
}

// ── API Response Wrappers ─────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
  };
  message?: string;
}

// ── Student Dashboard ─────────────────────────────────────────
export interface StudentDashboard {
  student: {
    id: string;
    name: string;
    email: string;
    level?: number;
    xp?: number;
    coins?: number;
    currentCareerId?: string;
    currentRoleId?: string;
  };
  career?: Career;
  technologies: (StudentTechnologyProgress & { technology: Technology })[];
  activeNodes: RoadmapNode[];
  recentActivity: {
    nodeId: string;
    nodeTitle: string;
    action: string;
    timestamp: string;
  }[];
  notificationsCount: number;
}
