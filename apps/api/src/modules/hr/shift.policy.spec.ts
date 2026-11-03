import {
  clockInVerdict,
  clockOutNote,
  localClock,
  officeDate,
  shiftFrom,
} from './shift.policy';

const ist = (hhmm: string, date = '2026-09-29') =>
  new Date(`${date}T${hhmm}:00+05:30`); // a Tuesday

describe('shift policy', () => {
  it('reads the profile settings and falls back on bad values', () => {
    expect(
      shiftFrom(
        JSON.stringify({
          shiftStartTime: '10:00',
          shiftEndTime: '19:00',
          gracePeriodMins: '10',
          weeklyOff: 'Sunday',
        }),
      ),
    ).toEqual({
      start: '10:00',
      end: '19:00',
      graceMins: 10,
      weeklyOff: ['Sunday'],
    });
    expect(shiftFrom('not json')).toEqual({
      start: '09:00',
      end: '18:00',
      graceMins: 15,
      weeklyOff: ['Saturday', 'Sunday'],
    });
    expect(
      shiftFrom(
        JSON.stringify({ shiftStartTime: '25:00', gracePeriodMins: -3 }),
      ).start,
    ).toBe('09:00');
  });

  it('uses office time, not server UTC', () => {
    expect(localClock(ist('09:20'), 'Asia/Kolkata')).toEqual({
      minutes: 560,
      weekday: 'Tuesday',
    });
  });

  it('marks late only past the grace period', () => {
    const shift = shiftFrom(null);
    expect(clockInVerdict(ist('09:14'), shift, 'Asia/Kolkata').status).toBe(
      'PRESENT',
    );
    const late = clockInVerdict(ist('09:47'), shift, 'Asia/Kolkata');
    expect(late.status).toBe('LATE');
    expect(late.note).toBe('Late by 47 min (shift starts 09:00).');
    expect(clockInVerdict(ist('08:40'), shift, 'Asia/Kolkata').status).toBe(
      'PRESENT',
    );
  });

  it('notes work on a weekly off', () => {
    expect(
      clockInVerdict(
        ist('09:00', '2026-10-04'),
        shiftFrom(null),
        'Asia/Kolkata',
      ).note,
    ).toBe('Worked on weekly off (Sunday).');
  });

  it('handles night shifts across midnight', () => {
    const night = shiftFrom(
      JSON.stringify({
        shiftStartTime: '22:00',
        shiftEndTime: '06:00',
        gracePeriodMins: 10,
      }),
    );
    expect(clockInVerdict(ist('00:30'), night, 'Asia/Kolkata').note).toContain(
      'Late by 2h 30m',
    );
    expect(clockInVerdict(ist('21:55'), night, 'Asia/Kolkata').status).toBe(
      'PRESENT',
    );
    expect(clockOutNote(ist('05:30'), night, 'Asia/Kolkata')).toBe(
      'Left 30 min early (shift ends 06:00).',
    );
    expect(clockOutNote(ist('06:05'), night, 'Asia/Kolkata')).toBe('');
  });

  it('notes an early exit', () => {
    expect(clockOutNote(ist('16:30'), shiftFrom(null), 'Asia/Kolkata')).toBe(
      'Left 1h 30m early (shift ends 18:00).',
    );
    expect(clockOutNote(ist('17:50'), shiftFrom(null), 'Asia/Kolkata')).toBe(
      '',
    );
    expect(clockOutNote(ist('19:30'), shiftFrom(null), 'Asia/Kolkata')).toBe(
      '',
    );
  });
});

describe('officeDate', () => {
  it('files a just-after-midnight punch under the office day', () => {
    expect(officeDate(new Date('2026-09-28T19:15:00Z'), 'Asia/Kolkata')).toBe(
      '2026-09-29',
    );
  });
});
