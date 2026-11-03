/**
 * An employee's shift, from the attendance settings on their profile, and what a punch means
 * against it. Times are office local time (HR_TIMEZONE, India by default), never server UTC.
 */
export interface Shift {
  start: string;
  end: string;
  graceMins: number;
  weeklyOff: string[];
}

export const DEFAULT_SHIFT: Shift = {
  start: '09:00',
  end: '18:00',
  graceMins: 15,
  weeklyOff: ['Saturday', 'Sunday'],
};
export const hrTimeZone = () => process.env.HR_TIMEZONE || 'Asia/Kolkata';

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const toMinutes = (t: string) => {
  const m = HHMM.exec(t)!;
  return Number(m[1]) * 60 + Number(m[2]);
};
const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/** The shift in the profile's attendance settings; missing or bad values fall back to the default. */
export function shiftFrom(settingsJson?: string | null): Shift {
  let s: any = {};
  try {
    s = settingsJson ? JSON.parse(settingsJson) : {};
  } catch {
    s = {};
  }
  const grace = Number(s?.gracePeriodMins);
  const weeklyOff = String(s?.weeklyOff ?? '')
    .split(/[,/]/)
    .map((d) => d.trim())
    .filter((d) => DAYS.includes(d));
  return {
    start: HHMM.test(String(s?.shiftStartTime))
      ? String(s.shiftStartTime)
      : DEFAULT_SHIFT.start,
    end: HHMM.test(String(s?.shiftEndTime))
      ? String(s.shiftEndTime)
      : DEFAULT_SHIFT.end,
    graceMins:
      Number.isFinite(grace) && grace >= 0 && grace <= 240
        ? Math.round(grace)
        : DEFAULT_SHIFT.graceMins,
    weeklyOff: s?.weeklyOff !== undefined ? weeklyOff : DEFAULT_SHIFT.weeklyOff,
  };
}

/** Minutes after local midnight and the weekday name, in the office time zone. */
export function localClock(at: Date, tz = hrTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'long',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return {
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: get('weekday'),
  };
}

const fmt = (mins: number) =>
  mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`;

/** LATE when the punch-in is after shift start plus grace. Night shifts (end before start) work too. */
export function clockInVerdict(clockIn: Date, shift: Shift, tz = hrTimeZone()) {
  const { minutes, weekday } = localClock(clockIn, tz);
  const start = toMinutes(shift.start);
  let after = minutes - start;
  if (after < -12 * 60) after += 24 * 60; // punched after midnight for a late-evening shift
  const late = after > shift.graceMins;
  const notes: string[] = [];
  if (late) notes.push(`Late by ${fmt(after)} (shift starts ${shift.start}).`);
  if (shift.weeklyOff.includes(weekday))
    notes.push(`Worked on weekly off (${weekday}).`);
  return {
    status: late ? ('LATE' as const) : ('PRESENT' as const),
    lateMinutes: Math.max(0, after),
    note: notes.join(' '),
  };
}

/** A note when someone leaves before the shift ends (beyond the same grace). */
export function clockOutNote(clockOut: Date, shift: Shift, tz = hrTimeZone()) {
  const start = toMinutes(shift.start);
  let end = toMinutes(shift.end);
  if (end <= start) end += 24 * 60;
  let now = localClock(clockOut, tz).minutes;
  if (now < start - 12 * 60 || (end > 24 * 60 && now < start)) now += 24 * 60;
  const early = end - now;
  return early > shift.graceMins
    ? `Left ${fmt(early)} early (shift ends ${shift.end}).`
    : '';
}

/** The office calendar date (YYYY-MM-DD) at a moment, so a 00:30 punch in India is not filed under yesterday. */
export function officeDate(at: Date, tz = hrTimeZone()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}
