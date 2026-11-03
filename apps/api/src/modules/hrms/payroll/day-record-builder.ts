import { DayRecord, DayCategory } from './lwp-calculator';

// Section 13 — turns WorkingWeek + HolidayCalendar + per-day attendance/leave
// overrides into the DayRecord[] calculateLwp() consumes. Precedence for a
// given calendar day, highest first: outside employment window (NOT_JOINED /
// AFTER_EXIT) > explicit attendance/leave record for that day > holiday >
// weekly off > default PRESENT. A day off (holiday/weekly-off) is calculated
// from the working-week/calendar BEFORE attendance is consulted, so a holiday
// an employee also happened to be marked ABSENT on still resolves to HOLIDAY,
// not ABSENT — this is the concrete mechanism behind "holiday/weekly-off days
// must not accidentally become LWP" (Section 13's explicit requirement).

export type WeekDayType = 'FULL_DAY' | 'HALF_DAY' | 'OFF' | 'ALTERNATE';

export interface WorkingWeekInput {
  monday: WeekDayType;
  tuesday: WeekDayType;
  wednesday: WeekDayType;
  thursday: WeekDayType;
  friday: WeekDayType;
  saturday: WeekDayType;
  sunday: WeekDayType;
  alternateSaturdayRule: 'NONE' | '1ST_3RD' | '2ND_4TH' | 'ALL';
}

const WEEKDAY_INDEX: Array<keyof WorkingWeekInput> = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function isOffDay(date: Date, workingWeek: WorkingWeekInput): boolean {
  const key = WEEKDAY_INDEX[date.getDay()];
  const dayType = workingWeek[key] as WeekDayType;
  if (dayType === 'OFF') return true;
  if (dayType === 'ALTERNATE' && key === 'saturday') {
    const weekOfMonth = Math.ceil(date.getDate() / 7); // 1st..5th Saturday of the month
    const rule = workingWeek.alternateSaturdayRule;
    if (rule === 'ALL') return true;
    if (rule === '1ST_3RD') return weekOfMonth === 1 || weekOfMonth === 3;
    if (rule === '2ND_4TH') return weekOfMonth === 2 || weekOfMonth === 4;
    return false;
  }
  return false;
}

export interface AttendanceOverride {
  category: Exclude<
    DayCategory,
    | 'HOLIDAY'
    | 'OPTIONAL_HOLIDAY'
    | 'WEEKLY_OFF'
    | 'COMP_OFF'
    | 'NOT_JOINED'
    | 'AFTER_EXIT'
  >;
}

export interface BuildDayRecordsInput {
  year: number;
  month: number; // 1-12
  workingWeek: WorkingWeekInput;
  holidayDates: Map<string, { isOptional: boolean }>; // ISO date -> holiday info
  attendanceByDate: Map<string, AttendanceOverride>; // ISO date -> PRESENT/ABSENT/HALF_DAY/PAID_LEAVE/UNPAID_LEAVE/COMP_OFF
  joiningDate?: Date;
  exitDate?: Date;
}

// Deliberately NOT `d.toISOString().slice(0, 10)` — that converts to UTC
// first, which silently shifts the date by one in any timezone behind UTC
// (caught by this file's own test suite: a machine on IST labeled local
// Aug-8 as "2026-08-07" and local Aug-9 as "2026-08-08", desynchronizing the
// label from the weekday isOffDay() actually computed against). Build the ISO
// string from the same local date components used everywhere else instead.
function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function buildDayRecords(input: BuildDayRecordsInput): DayRecord[] {
  const {
    year,
    month,
    workingWeek,
    holidayDates,
    attendanceByDate,
    joiningDate,
    exitDate,
  } = input;
  const daysInMonth = new Date(year, month, 0).getDate();
  const records: DayRecord[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const iso = toIsoDate(date);

    let category: DayCategory;
    if (
      joiningDate &&
      date <
        new Date(
          joiningDate.getFullYear(),
          joiningDate.getMonth(),
          joiningDate.getDate(),
        )
    ) {
      category = 'NOT_JOINED';
    } else if (
      exitDate &&
      date >
        new Date(
          exitDate.getFullYear(),
          exitDate.getMonth(),
          exitDate.getDate(),
        )
    ) {
      category = 'AFTER_EXIT';
    } else {
      const holiday = holidayDates.get(iso);
      if (holiday) {
        category = holiday.isOptional ? 'OPTIONAL_HOLIDAY' : 'HOLIDAY';
      } else if (isOffDay(date, workingWeek)) {
        category = 'WEEKLY_OFF';
      } else {
        const attendance = attendanceByDate.get(iso);
        category = attendance?.category ?? 'PRESENT';
      }
    }

    records.push({ date: iso, category });
  }

  return records;
}
