import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollAuditService } from './payroll-audit.service';

const AUDITED_FIELDS = [
  'name',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'alternateSaturdayRule',
];

// Section 12 — configurable working week, one active configuration at a time
// per org (mirrors the deactivate-old/create-new pattern used by
// PayrollConfigService, without full audit-log versioning since working-week
// changes are infrequent structural facts, not per-field statutory numbers).

const VALID_DAY_TYPES = ['FULL_DAY', 'HALF_DAY', 'OFF', 'ALTERNATE'];
const VALID_ALT_RULES = ['NONE', '1ST_3RD', '2ND_4TH', 'ALL'];

export interface WorkingWeekDto {
  name?: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  alternateSaturdayRule?: string;
}

function validate(dto: WorkingWeekDto) {
  for (const key of [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ] as const) {
    const val = dto[key];
    if (val !== undefined && !VALID_DAY_TYPES.includes(val)) {
      throw new BadRequestException(
        `${key} must be one of ${VALID_DAY_TYPES.join(', ')}.`,
      );
    }
  }
  if (
    dto.alternateSaturdayRule !== undefined &&
    !VALID_ALT_RULES.includes(dto.alternateSaturdayRule)
  ) {
    throw new BadRequestException(
      `alternateSaturdayRule must be one of ${VALID_ALT_RULES.join(', ')}.`,
    );
  }
}

const DEFAULTS: Required<Omit<WorkingWeekDto, 'name'>> = {
  monday: 'FULL_DAY',
  tuesday: 'FULL_DAY',
  wednesday: 'FULL_DAY',
  thursday: 'FULL_DAY',
  friday: 'FULL_DAY',
  saturday: 'OFF',
  sunday: 'OFF',
  alternateSaturdayRule: 'NONE',
};

@Injectable()
export class WorkingWeekService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async getCurrent(organizationId: string) {
    const active = await this.prisma.workingWeek.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (active) return active;
    return this.prisma.workingWeek.create({
      data: {
        organizationId,
        isActive: true,
        ...DEFAULTS,
        name: 'Default',
      } as any,
    });
  }

  async update(
    organizationId: string,
    dto: WorkingWeekDto,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to update the working week.',
      );
    validate(dto);
    const current = await this.getCurrent(organizationId);
    const now = new Date();

    await this.prisma.workingWeek.update({
      where: { id: current.id },
      data: { isActive: false, effectiveTo: now },
    });

    const created = await this.prisma.workingWeek.create({
      data: {
        organizationId,
        name: dto.name ?? current.name,
        monday: (dto.monday ?? current.monday) as any,
        tuesday: (dto.tuesday ?? current.tuesday) as any,
        wednesday: (dto.wednesday ?? current.wednesday) as any,
        thursday: (dto.thursday ?? current.thursday) as any,
        friday: (dto.friday ?? current.friday) as any,
        saturday: (dto.saturday ?? current.saturday) as any,
        sunday: (dto.sunday ?? current.sunday) as any,
        alternateSaturdayRule:
          dto.alternateSaturdayRule ?? current.alternateSaturdayRule,
        isActive: true,
        effectiveFrom: now,
      },
    });
    await this.audit.recordDiff(
      organizationId,
      'WORKING_WEEK',
      created.id,
      userId,
      reason,
      current,
      created,
      AUDITED_FIELDS,
    );
    return created;
  }
}
