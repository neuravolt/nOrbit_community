/**
 * Joining and exit checklists. Items the system can prove from real data (bank details saved, face
 * enrolled, assets returned, F&F settled...) tick themselves and cannot be ticked by hand; the rest
 * are ticked by HR and remember who ticked them and when.
 */
export type ChecklistKind = 'ONBOARDING' | 'OFFBOARDING';

export interface EmployeeFacts {
  joiningDate?: Date | null;
  mobileNumber?: string | null;
  panNumber?: string | null;
  hasBank: boolean;
  hasSalary: boolean;
  faceEnrolled: boolean;
  hasSignedIn: boolean;
  offerLetterIssued: boolean;
  openAssets: number;
  assetsEverIssued: number;
  exitDate?: Date | null;
  exitInterviewNotes?: string | null;
  ffSettled: boolean;
  loginActive: boolean;
  status?: string | null;
}

interface ItemDef {
  key: string;
  title: string;
  auto?: (f: EmployeeFacts) => boolean;
  manual: boolean;
  hint?: string;
}

export const ONBOARDING: ItemDef[] = [
  {
    key: 'profile',
    title: 'Joining date and phone number',
    auto: (f) => !!f.joiningDate && !!f.mobileNumber,
    manual: false,
    hint: 'Edit the employee profile',
  },
  {
    key: 'offer',
    title: 'Offer or appointment letter issued',
    auto: (f) => f.offerLetterIssued,
    manual: true,
    hint: 'Documents > Generate',
  },
  { key: 'nda', title: 'NDA signed', manual: true },
  {
    key: 'pan',
    title: 'PAN recorded',
    auto: (f) => !!f.panNumber,
    manual: false,
    hint: 'Profile > Government IDs',
  },
  {
    key: 'bank',
    title: 'Bank account and IFSC saved',
    auto: (f) => f.hasBank,
    manual: false,
    hint: 'Profile > Bank details',
  },
  {
    key: 'salary',
    title: 'Salary structure set',
    auto: (f) => f.hasSalary,
    manual: false,
    hint: 'Payroll > Salary',
  },
  {
    key: 'accounts',
    title: 'Work email and tool access created',
    manual: true,
  },
  {
    key: 'assets',
    title: 'Laptop or other assets issued',
    auto: (f) => f.assetsEverIssued > 0,
    manual: true,
    hint: 'Assets tab',
  },
  {
    key: 'signin',
    title: 'Signed in and set own password',
    auto: (f) => f.hasSignedIn,
    manual: false,
    hint: 'Resend the invite if needed',
  },
  {
    key: 'face',
    title: 'Face enrolled for attendance',
    auto: (f) => f.faceEnrolled,
    manual: false,
    hint: 'Employee enrolls on first check-in',
  },
  {
    key: 'induction',
    title: 'Induction and first-day walkthrough',
    manual: true,
  },
];

export const OFFBOARDING: ItemDef[] = [
  {
    key: 'exit_date',
    title: 'Last working day set',
    auto: (f) => !!f.exitDate,
    manual: false,
  },
  { key: 'handover', title: 'Work handed over', manual: true },
  {
    key: 'assets_returned',
    title: 'All assets returned',
    auto: (f) => f.openAssets === 0,
    manual: false,
    hint: 'Assets tab',
  },
  {
    key: 'exit_interview',
    title: 'Exit interview done',
    auto: (f) => !!f.exitInterviewNotes?.trim(),
    manual: true,
  },
  {
    key: 'fnf',
    title: 'Full and final settled',
    auto: (f) => f.ffSettled,
    manual: false,
    hint: 'Payroll > Statements & F&F',
  },
  {
    key: 'relieving',
    title: 'Relieving and experience letter issued',
    manual: true,
  },
  {
    key: 'access',
    title: 'Login disabled',
    auto: (f) => !f.loginActive,
    manual: false,
  },
];

export type ChecklistState = Partial<
  Record<ChecklistKind, Record<string, { at: string; by: string }>>
>;

export function parseChecklist(json?: string | null): ChecklistState {
  try {
    const v = json ? JSON.parse(json) : {};
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export const isLeaving = (f: EmployeeFacts) =>
  !!f.exitDate ||
  ['RESIGNED', 'TERMINATED', 'NOTICE_PERIOD'].includes(String(f.status || ''));

export function buildChecklist(
  kind: ChecklistKind,
  facts: EmployeeFacts,
  state: ChecklistState,
) {
  const defs = kind === 'ONBOARDING' ? ONBOARDING : OFFBOARDING;
  const ticks = state[kind] || {};
  const items = defs.map((d) => {
    const auto = d.auto ? d.auto(facts) : false;
    const tick = d.manual ? ticks[d.key] : undefined;
    return {
      key: d.key,
      title: d.title,
      hint: d.hint || null,
      manual: d.manual,
      done: auto || !!tick,
      source: auto ? ('system' as const) : tick ? ('hr' as const) : null,
      doneAt: !auto && tick ? tick.at : null,
      doneBy: !auto && tick ? tick.by : null,
    };
  });
  return {
    kind,
    items,
    done: items.filter((i) => i.done).length,
    total: items.length,
  };
}

/** Ticks or unticks a manual item; system items and unknown keys are refused (null). */
export function setTick(
  state: ChecklistState,
  kind: ChecklistKind,
  key: string,
  done: boolean,
  by: string,
  at = new Date(),
): ChecklistState | null {
  const def = (kind === 'ONBOARDING' ? ONBOARDING : OFFBOARDING).find(
    (d) => d.key === key,
  );
  if (!def || !def.manual) return null;
  const next: ChecklistState = { ...state, [kind]: { ...(state[kind] || {}) } };
  if (done) next[kind]![key] = { at: at.toISOString(), by };
  else delete next[kind]![key];
  return next;
}
