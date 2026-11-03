import { BadRequestException } from '@nestjs/common';
import { HolidayCalendarService } from './holiday-calendar.service';

// Gap-closure item 2/5 — calendar create/update/deactivate, holiday
// create/update/remove, and assignment changes must all be audited.
describe('HolidayCalendarService — audit trail', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: HolidayCalendarService;

  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';

  beforeEach(() => {
    prismaMock = {
      holidayCalendar: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      holiday: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      holidayCalendarAssignment: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = { recordAction: jest.fn(), recordDiff: jest.fn() };
    service = new HolidayCalendarService(prismaMock, auditMock);
  });

  it('createCalendar() records a CREATE action', async () => {
    prismaMock.holidayCalendar.findFirst.mockResolvedValue(null);
    prismaMock.holidayCalendar.create.mockResolvedValue({
      id: 'cal-1',
      name: 'Karnataka 2026',
      year: 2026,
    });

    await service.createCalendar(
      ORG_ID,
      { name: 'Karnataka 2026', year: 2026 },
      USER_ID,
      'New state calendar',
    );

    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY_CALENDAR',
      'cal-1',
      'CREATE',
      USER_ID,
      'New state calendar',
      expect.any(Object),
    );
  });

  it('updateCalendar() rejects with no reason and records a diff when a reason is given', async () => {
    const existing = {
      id: 'cal-1',
      organizationId: ORG_ID,
      name: 'Karnataka 2026',
      state: 'Karnataka',
      location: null,
    };
    prismaMock.holidayCalendar.findUnique.mockResolvedValue(existing);

    await expect(
      service.updateCalendar('cal-1', { state: 'KA' }, ORG_ID, USER_ID, ''),
    ).rejects.toBeInstanceOf(BadRequestException);

    const updated = { ...existing, state: 'KA' };
    prismaMock.holidayCalendar.update.mockResolvedValue(updated);
    await service.updateCalendar(
      'cal-1',
      { state: 'KA' },
      ORG_ID,
      USER_ID,
      'Corrected state code',
    );

    expect(auditMock.recordDiff).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY_CALENDAR',
      'cal-1',
      USER_ID,
      'Corrected state code',
      existing,
      updated,
      expect.arrayContaining(['state']),
    );
  });

  it('deactivateCalendar() records a DEACTIVATE action and requires a reason', async () => {
    prismaMock.holidayCalendar.findUnique.mockResolvedValue({
      id: 'cal-1',
      organizationId: ORG_ID,
    });
    await expect(
      service.deactivateCalendar('cal-1', ORG_ID, USER_ID, ''),
    ).rejects.toBeInstanceOf(BadRequestException);

    prismaMock.holidayCalendar.update.mockResolvedValue({
      id: 'cal-1',
      isActive: false,
    });
    await service.deactivateCalendar(
      'cal-1',
      ORG_ID,
      USER_ID,
      'Calendar retired',
    );
    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY_CALENDAR',
      'cal-1',
      'DEACTIVATE',
      USER_ID,
      'Calendar retired',
    );
  });

  it('addHoliday() records a CREATE action for the holiday', async () => {
    prismaMock.holidayCalendar.findUnique.mockResolvedValue({
      id: 'cal-1',
      organizationId: ORG_ID,
      year: 2026,
    });
    prismaMock.holiday.findFirst.mockResolvedValue(null);
    prismaMock.holiday.create.mockResolvedValue({
      id: 'hol-1',
      name: 'Independence Day',
    });

    await service.addHoliday(
      'cal-1',
      { date: '2026-08-15', name: 'Independence Day' },
      ORG_ID,
      USER_ID,
      'Added national holiday',
    );

    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY',
      'hol-1',
      'CREATE',
      USER_ID,
      'Added national holiday',
      expect.any(Object),
    );
  });

  it('updateHoliday() requires a reason and records a diff', async () => {
    const existing = {
      id: 'hol-1',
      name: 'Independence Day',
      type: 'PUBLIC',
      isPaid: true,
      isOptional: false,
      calendar: { organizationId: ORG_ID },
    };
    prismaMock.holiday.findUnique.mockResolvedValue(existing);

    await expect(
      service.updateHoliday('hol-1', { isPaid: false }, ORG_ID, USER_ID, ''),
    ).rejects.toBeInstanceOf(BadRequestException);

    const updated = { ...existing, isPaid: false };
    prismaMock.holiday.update.mockResolvedValue(updated);
    await service.updateHoliday(
      'hol-1',
      { isPaid: false },
      ORG_ID,
      USER_ID,
      'Reclassified as unpaid',
    );

    expect(auditMock.recordDiff).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY',
      'hol-1',
      USER_ID,
      'Reclassified as unpaid',
      existing,
      updated,
      expect.arrayContaining(['isPaid']),
    );
  });

  it('removeHoliday() soft-deletes and records a DEACTIVATE action', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({
      id: 'hol-1',
      calendar: { organizationId: ORG_ID },
    });
    await expect(
      service.removeHoliday('hol-1', ORG_ID, USER_ID, ''),
    ).rejects.toBeInstanceOf(BadRequestException);

    prismaMock.holiday.update.mockResolvedValue({
      id: 'hol-1',
      isActive: false,
    });
    await service.removeHoliday('hol-1', ORG_ID, USER_ID, 'Duplicate entry');
    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY',
      'hol-1',
      'DEACTIVATE',
      USER_ID,
      'Duplicate entry',
    );
  });

  it('assignEmployee() records an ASSIGN action, and an UPDATE action on any prior assignment it ends', async () => {
    prismaMock.holidayCalendar.findUnique.mockResolvedValue({
      id: 'cal-1',
      organizationId: ORG_ID,
    });
    prismaMock.holidayCalendarAssignment.findFirst.mockResolvedValue({
      id: 'assign-old',
    });
    prismaMock.holidayCalendarAssignment.create.mockResolvedValue({
      id: 'assign-new',
    });

    await service.assignEmployee(
      'cal-1',
      'emp-1',
      ORG_ID,
      USER_ID,
      'Employee relocated to Karnataka office',
    );

    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY_ASSIGNMENT',
      'assign-old',
      'UPDATE',
      USER_ID,
      'Employee relocated to Karnataka office',
      expect.any(Object),
    );
    expect(auditMock.recordAction).toHaveBeenCalledWith(
      ORG_ID,
      'HOLIDAY_ASSIGNMENT',
      'assign-new',
      'ASSIGN',
      USER_ID,
      'Employee relocated to Karnataka office',
      expect.any(Object),
    );
  });
});
