import { BadRequestException } from '@nestjs/common';
import { WorkingWeekService } from './working-week.service';

// P1 gap-closure — dedicated Working Week audit test. Proves the audit
// record actually written carries actor, reason, and old/new values per
// changed field — not just that the code "looks similar" to other audited
// services.
describe('WorkingWeekService — audit trail', () => {
  let prismaMock: any;
  let auditMock: any;
  let service: WorkingWeekService;

  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';

  const CURRENT = {
    id: 'week-1',
    organizationId: ORG_ID,
    name: 'Default',
    isActive: true,
    monday: 'FULL_DAY',
    tuesday: 'FULL_DAY',
    wednesday: 'FULL_DAY',
    thursday: 'FULL_DAY',
    friday: 'FULL_DAY',
    saturday: 'OFF',
    sunday: 'OFF',
    alternateSaturdayRule: 'NONE',
  };

  beforeEach(() => {
    prismaMock = {
      workingWeek: {
        findFirst: jest.fn().mockResolvedValue(CURRENT),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    auditMock = { recordDiff: jest.fn() };
    service = new WorkingWeekService(prismaMock, auditMock);
  });

  it('rejects an update with no reason, and writes no audit row', async () => {
    await expect(
      service.update(ORG_ID, { saturday: 'ALTERNATE' }, USER_ID, ''),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(auditMock.recordDiff).not.toHaveBeenCalled();
    expect(prismaMock.workingWeek.create).not.toHaveBeenCalled();
  });

  it('records an audit diff with the actor, the reason, and old/new values for each changed field', async () => {
    const created = {
      ...CURRENT,
      id: 'week-2',
      saturday: 'ALTERNATE',
      alternateSaturdayRule: '1ST_3RD',
    };
    prismaMock.workingWeek.create.mockResolvedValue(created);

    const result = await service.update(
      ORG_ID,
      { saturday: 'ALTERNATE', alternateSaturdayRule: '1ST_3RD' },
      USER_ID,
      'Switched to alternate Saturdays',
    );

    expect(result).toBe(created);
    expect(auditMock.recordDiff).toHaveBeenCalledWith(
      ORG_ID,
      'WORKING_WEEK',
      'week-2',
      USER_ID,
      'Switched to alternate Saturdays',
      CURRENT,
      created,
      expect.arrayContaining(['saturday', 'alternateSaturdayRule']),
    );
  });

  it('deactivates the previous version rather than mutating it in place', async () => {
    prismaMock.workingWeek.create.mockResolvedValue({
      ...CURRENT,
      id: 'week-2',
    });
    await service.update(
      ORG_ID,
      { sunday: 'HALF_DAY' },
      USER_ID,
      'Half-day Sundays trial',
    );

    expect(prismaMock.workingWeek.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'week-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it('rejects an invalid day-type value before touching the database', async () => {
    await expect(
      service.update(
        ORG_ID,
        { monday: 'NOT_A_REAL_TYPE' as any },
        USER_ID,
        'bad input',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.workingWeek.create).not.toHaveBeenCalled();
  });
});
