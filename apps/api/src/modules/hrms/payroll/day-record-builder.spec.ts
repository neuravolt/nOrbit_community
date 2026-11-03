import { buildDayRecords, WorkingWeekInput } from './day-record-builder';
import { calculateLwp } from './lwp-calculator';

const STANDARD_WEEK: WorkingWeekInput = {
  monday: 'FULL_DAY',
  tuesday: 'FULL_DAY',
  wednesday: 'FULL_DAY',
  thursday: 'FULL_DAY',
  friday: 'FULL_DAY',
  saturday: 'OFF',
  sunday: 'OFF',
  alternateSaturdayRule: 'NONE',
};

describe('buildDayRecords', () => {
  it('marks Saturdays and Sundays as WEEKLY_OFF for a standard 5-day week', () => {
    // August 2026: 1st is a Saturday
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map(),
      attendanceByDate: new Map(),
    });
    const sat1 = records.find((r) => r.date === '2026-08-01');
    expect(sat1?.category).toBe('WEEKLY_OFF');
  });

  it('a holiday takes precedence over attendance marked ABSENT that day', () => {
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map([['2026-08-15', { isOptional: false }]]),
      attendanceByDate: new Map([['2026-08-15', { category: 'ABSENT' }]]),
    });
    const holiday = records.find((r) => r.date === '2026-08-15');
    expect(holiday?.category).toBe('HOLIDAY');
  });

  it('an optional holiday is categorized separately from a mandatory holiday', () => {
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map([['2026-08-20', { isOptional: true }]]),
      attendanceByDate: new Map(),
    });
    expect(records.find((r) => r.date === '2026-08-20')?.category).toBe(
      'OPTIONAL_HOLIDAY',
    );
  });

  it('applies alternate-Saturday rules: 1ST_3RD marks only the 1st and 3rd Saturday OFF', () => {
    const altWeek: WorkingWeekInput = {
      ...STANDARD_WEEK,
      saturday: 'ALTERNATE',
      alternateSaturdayRule: '1ST_3RD',
    };
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: altWeek,
      holidayDates: new Map(),
      attendanceByDate: new Map(),
    });
    // August 2026 Saturdays: 1, 8, 15, 22, 29 -> 1st and 3rd (15) OFF, 2nd/4th/5th (8,22,29) working
    expect(records.find((r) => r.date === '2026-08-01')?.category).toBe(
      'WEEKLY_OFF',
    );
    expect(records.find((r) => r.date === '2026-08-15')?.category).toBe(
      'WEEKLY_OFF',
    );
    expect(records.find((r) => r.date === '2026-08-08')?.category).not.toBe(
      'WEEKLY_OFF',
    );
  });

  it('a day before the joining date is NOT_JOINED regardless of attendance data', () => {
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map(),
      attendanceByDate: new Map([['2026-08-03', { category: 'PRESENT' }]]),
      joiningDate: new Date(2026, 7, 10),
    });
    expect(records.find((r) => r.date === '2026-08-03')?.category).toBe(
      'NOT_JOINED',
    );
  });

  it('a day after the exit date is AFTER_EXIT', () => {
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map(),
      attendanceByDate: new Map(),
      exitDate: new Date(2026, 7, 20),
    });
    expect(records.find((r) => r.date === '2026-08-25')?.category).toBe(
      'AFTER_EXIT',
    );
  });

  it('defaults an unmarked working day to PRESENT', () => {
    const records = buildDayRecords({
      year: 2026,
      month: 8,
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map(),
      attendanceByDate: new Map(),
    });
    expect(records.find((r) => r.date === '2026-08-03')?.category).toBe(
      'PRESENT',
    ); // a Monday
  });

  it('end-to-end: feeding built records into calculateLwp produces zero LWP for a normal working month with holidays and weekly offs', () => {
    const records = buildDayRecords({
      year: 2026,
      month: 8, // 31 days, 5 weekends+... let's just trust the working-week logic
      workingWeek: STANDARD_WEEK,
      holidayDates: new Map([['2026-08-15', { isOptional: false }]]),
      attendanceByDate: new Map(), // everything else defaults to PRESENT
    });
    const result = calculateLwp({ days: records, calculationBase: 'CALENDAR' });
    expect(result.lwpDays).toBe(0);
    expect(result.payableDays).toBe(result.calendarDays);
  });
});
