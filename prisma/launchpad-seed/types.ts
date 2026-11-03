// Single source of truth for authored Launchpad curriculum content (Part 3/4/4a of the
// Verification Engine plan). One role = one file under roles/. mapper.ts writes this shape
// into the Launchpad-prefixed table family (LaunchpadCareer -> ... -> LaunchpadRoadmapNode).

export type DifficultyTier = 'explorer' | 'beginner' | 'intermediate' | 'advanced' | 'professional' | 'expert';
export type ChallengeType = 'practice' | 'career' | 'milestone' | 'capstone';

export interface Resource {
  title: string;
  url: string;
  type: 'video' | 'doc' | 'article';
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface InterviewQuestion {
  pattern: string; // deterministic code-pattern key this question is surfaced for (Part 4)
  difficulty: 'easy' | 'medium' | 'hard';
  experienceLevel: 'junior' | 'mid' | 'senior';
  question: string;
  expectedAnswer: string;
  evaluationRubric: string[];
}

export interface ChallengeSpec {
  objective: string;
  requirements: string[]; // "prefix:value" strings consumed by the pattern engine, e.g. "route:GET /todos"
  resources: Resource[];
  hints: string[];
  evaluationCriteria: string[];
  expectedSkills: string[];
  difficulty: DifficultyTier;
  multiplier: number; // 1.0 (explorer) .. 2.5 (expert)
  xp: number;
  challengeType: ChallengeType;
}

export interface NodeContent {
  nodeNumber: number;
  title: string;
  slug: string;
  description: string;
  learningObjectives: string[];
  videos: Resource[];
  officialDocs: Resource[];
  notes: string;
  cheatsheet: string;
  codeExamples: { title: string; code: string; language: string }[];
  quizQuestions: QuizQuestion[];
  miniProject: { title: string; description: string; requirements: string[] };
  interviewBank: InterviewQuestion[];
  xpReward: number;
  coinsReward: number;
  skillMapping: Record<string, number>; // skill name -> point contribution, Part 4
  difficulty: DifficultyTier;
  trustLevel: 'A' | 'B' | 'C';
  challenge?: ChallengeSpec; // present only on the level's final, integrated node (Part 4a)
  // Optional: contribution to the 4 canonical Career DNA strands (see apps/web/app/student/
  // career-dna/page.tsx's STRAND_META) — "Technical Mastery" | "Execution Focus" |
  // "Problem Solving" | "Collaborative Sync". The DB column already existed (career_dna_impact)
  // but mapper.ts previously hardcoded it to {} for every node; this makes it authorable.
  careerDnaImpact?: Record<string, number>;
}

export interface LevelContent {
  levelNumber: number;
  name: string;
  description: string;
  difficulty: DifficultyTier;
  estimatedDurationHours: number;
  xpRequired: number;
  nodes: NodeContent[];
}

export interface RoleContent {
  careerName: string;
  careerSlug: string;
  roleName: string;
  roleSlug: string;
  roleDescription: string;
  technologyName: string;
  technologySlug: string; // must match a key in verification-engine.constants.ts's framework map
  technologyDescription: string;
  levels: LevelContent[];
}
