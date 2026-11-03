export * from '@neuravolt/shared-prisma';

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: any;
}

// Single source of truth for which ContentStep.language values may carry runnable: true.
// Consumed identically by the AI prompt (apps/worker), validation (apps/worker + apps/api),
// and the frontend's EXECUTION_ADAPTERS registry keys, so the three can never drift apart.
// Phase 1 only: TypeScript is deliberately excluded until react-live's Babel-standalone TS
// preset is verified to work, not assumed.
export const SUPPORTED_LIVE_EXECUTION_LANGUAGES = ['jsx', 'javascript'] as const;

export type SupportedLiveExecutionLanguage = (typeof SUPPORTED_LIVE_EXECUTION_LANGUAGES)[number];

export interface ContentStepPredictOutput {
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ContentStep {
  title: string;
  explanation: string;
  code: string;
  language: string;
  runnable: boolean;
  diagram?: string;
  predictOutput?: ContentStepPredictOutput;
}
