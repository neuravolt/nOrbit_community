import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PayrollWorkflowService } from './payroll-workflow.service';

// Section 20/26 — the workflow state machine: valid transitions, invalid
// transitions, and the hard invariant that a FINALIZED or LOCKED run can
// never be recalculated. These guard checks run before any config/employee
// data is touched, so a minimal mocked prisma (plus stub collaborators) is
// enough to exercise them without a live database.
describe('PayrollWorkflowService — workflow state machine', () => {
  let prismaMock: any;
  let service: PayrollWorkflowService;

  function runWithStatus(status: string) {
    return {
      id: 'run-1',
      organizationId: 'org-1',
      month: 8,
      year: 2026,
      status,
      createdBy: 'creator-1',
    };
  }

  beforeEach(() => {
    prismaMock = {
      payrollRun: {
        findUnique: jest.fn(),
        update: jest.fn(async ({ data }: any) => ({ ...data })),
      },
    };
    // The other collaborators are never reached by a rejected transition —
    // calculate() only touches them after assertTransition passes.
    service = new PayrollWorkflowService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  });

  describe('calculate()', () => {
    it('is allowed from DRAFT', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('DRAFT'),
      );
      // Will throw further in — no components/salaries mocked — but the
      // transition guard itself must not be what throws.
      await expect(
        service.calculate('run-1', 'user-1'),
      ).rejects.not.toBeInstanceOf(BadRequestException);
    });

    it('is allowed from CALCULATED (recalculation)', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('CALCULATED'),
      );
      await expect(service.calculate('run-1', 'user-1')).rejects.not.toThrow(
        /Cannot calculate/,
      );
    });

    for (const blockedStatus of [
      'REVIEW',
      'APPROVED',
      'FINALIZED',
      'LOCKED',
      'PAID',
      'CANCELLED',
    ]) {
      it(`is rejected from ${blockedStatus}`, async () => {
        prismaMock.payrollRun.findUnique.mockResolvedValue(
          runWithStatus(blockedStatus),
        );
        await expect(
          service.calculate('run-1', 'user-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
        await expect(service.calculate('run-1', 'user-1')).rejects.toThrow(
          /Cannot calculate/,
        );
      });
    }

    it('throws NotFoundException when the run does not exist', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(null);
      await expect(
        service.calculate('missing', 'user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('review()', () => {
    it('is allowed only from CALCULATED', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('CALCULATED'),
      );
      const result = await service.review('run-1');
      expect(result.status).toBe('REVIEW');
    });

    for (const blockedStatus of [
      'DRAFT',
      'REVIEW',
      'APPROVED',
      'FINALIZED',
      'LOCKED',
    ]) {
      it(`is rejected from ${blockedStatus}`, async () => {
        prismaMock.payrollRun.findUnique.mockResolvedValue(
          runWithStatus(blockedStatus),
        );
        await expect(service.review('run-1')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });
    }
  });

  describe('approve()', () => {
    it('is allowed from CALCULATED', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('CALCULATED'),
      );
      const result = await service.approve('run-1', 'approver-1');
      expect(result.status).toBe('APPROVED');
      expect(result.approvedBy).toBe('approver-1');
    });

    it('is allowed from REVIEW', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('REVIEW'),
      );
      const result = await service.approve('run-1', 'approver-1');
      expect(result.status).toBe('APPROVED');
    });

    for (const blockedStatus of ['DRAFT', 'APPROVED', 'FINALIZED', 'LOCKED']) {
      it(`is rejected from ${blockedStatus}`, async () => {
        prismaMock.payrollRun.findUnique.mockResolvedValue(
          runWithStatus(blockedStatus),
        );
        await expect(
          service.approve('run-1', 'approver-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    }
  });

  describe('finalize()', () => {
    it('is allowed only from APPROVED', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('APPROVED'),
      );
      const result = await service.finalize('run-1', 'finalizer-1');
      expect(result.status).toBe('FINALIZED');
    });

    for (const blockedStatus of [
      'DRAFT',
      'CALCULATED',
      'REVIEW',
      'FINALIZED',
      'LOCKED',
    ]) {
      it(`is rejected from ${blockedStatus} — a finalized/pre-approval run cannot be finalized again or early`, async () => {
        prismaMock.payrollRun.findUnique.mockResolvedValue(
          runWithStatus(blockedStatus),
        );
        await expect(
          service.finalize('run-1', 'finalizer-1'),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    }
  });

  describe('lock()', () => {
    it('is allowed only from FINALIZED', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('FINALIZED'),
      );
      const result = await service.lock('run-1', 'locker-1');
      expect(result.status).toBe('LOCKED');
    });

    for (const blockedStatus of [
      'DRAFT',
      'CALCULATED',
      'REVIEW',
      'APPROVED',
      'LOCKED',
    ]) {
      it(`is rejected from ${blockedStatus} — an already-locked run cannot be locked again`, async () => {
        prismaMock.payrollRun.findUnique.mockResolvedValue(
          runWithStatus(blockedStatus),
        );
        await expect(service.lock('run-1', 'locker-1')).rejects.toBeInstanceOf(
          BadRequestException,
        );
      });
    }
  });

  describe('immutability of FINALIZED/LOCKED runs', () => {
    it('a FINALIZED run cannot be recalculated, reviewed, or re-approved', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('FINALIZED'),
      );
      await expect(service.calculate('run-1', 'u')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.review('run-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.approve('run-1', 'u')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('a LOCKED run cannot be recalculated, reviewed, approved, or finalized again', async () => {
      prismaMock.payrollRun.findUnique.mockResolvedValue(
        runWithStatus('LOCKED'),
      );
      await expect(service.calculate('run-1', 'u')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.review('run-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.approve('run-1', 'u')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.finalize('run-1', 'u')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
