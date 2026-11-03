import {
  buildChecklist,
  EmployeeFacts,
  isLeaving,
  parseChecklist,
  setTick,
} from './employee-checklist.policy';

const facts = (over: Partial<EmployeeFacts> = {}): EmployeeFacts => ({
  joiningDate: new Date('2026-09-01'),
  mobileNumber: '9800000000',
  panNumber: null,
  hasBank: true,
  hasSalary: false,
  faceEnrolled: false,
  hasSignedIn: true,
  offerLetterIssued: false,
  openAssets: 0,
  assetsEverIssued: 0,
  exitDate: null,
  exitInterviewNotes: null,
  ffSettled: false,
  loginActive: true,
  status: 'ACTIVE',
  ...over,
});

describe('employee checklist', () => {
  it('ticks items the record proves and leaves the rest open', () => {
    const c = buildChecklist('ONBOARDING', facts(), {});
    const by = Object.fromEntries(c.items.map((i) => [i.key, i]));
    expect(by.bank).toMatchObject({ done: true, source: 'system' });
    expect(by.signin.done).toBe(true);
    expect(by.salary.done).toBe(false);
    expect(by.nda).toMatchObject({ done: false, manual: true });
    expect(c.done).toBe(3);
    expect(c.total).toBe(11);
  });

  it('HR can tick manual items but not ones the system decides', () => {
    const s = setTick(
      {},
      'ONBOARDING',
      'nda',
      true,
      'Asha HR',
      new Date('2026-09-02T10:00:00Z'),
    )!;
    expect(s.ONBOARDING!.nda).toEqual({
      at: '2026-09-02T10:00:00.000Z',
      by: 'Asha HR',
    });
    const c = buildChecklist('ONBOARDING', facts(), s);
    expect(c.items.find((i) => i.key === 'nda')).toMatchObject({
      done: true,
      source: 'hr',
      doneBy: 'Asha HR',
    });
    expect(setTick({}, 'ONBOARDING', 'bank', true, 'x')).toBeNull();
    expect(setTick({}, 'OFFBOARDING', 'nope', true, 'x')).toBeNull();
    expect(setTick(s, 'ONBOARDING', 'nda', false, 'x')!.ONBOARDING).toEqual({});
  });

  it('exit checklist follows real data', () => {
    const leaving = facts({
      exitDate: new Date('2026-10-15'),
      openAssets: 1,
      ffSettled: true,
      loginActive: false,
    });
    expect(isLeaving(leaving)).toBe(true);
    expect(isLeaving(facts())).toBe(false);
    expect(isLeaving(facts({ status: 'NOTICE_PERIOD' }))).toBe(true);
    const c = buildChecklist('OFFBOARDING', leaving, {});
    const by = Object.fromEntries(c.items.map((i) => [i.key, i.done]));
    expect(by).toMatchObject({
      exit_date: true,
      assets_returned: false,
      fnf: true,
      access: true,
      handover: false,
    });
  });

  it('ignores a broken stored value', () => {
    expect(parseChecklist('{oops')).toEqual({});
  });
});
