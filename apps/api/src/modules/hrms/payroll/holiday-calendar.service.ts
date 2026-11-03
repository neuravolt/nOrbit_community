import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PayrollAuditService } from './payroll-audit.service';

// Section 11 — a dedicated, multi-calendar holiday system (deliberately
// separate from the pre-existing CompanyHoliday model — see the schema
// comment on HolidayCalendar for why).

export interface CreateCalendarDto {
  name: string;
  year: number;
  state?: string;
  location?: string;
}

export interface CreateHolidayDto {
  date: string;
  name: string;
  type?: 'PUBLIC' | 'OPTIONAL' | 'RESTRICTED';
  isPaid?: boolean;
  isOptional?: boolean;
}

const CALENDAR_AUDITED_FIELDS = ['name', 'state', 'location', 'isActive'];
const HOLIDAY_AUDITED_FIELDS = [
  'name',
  'type',
  'isPaid',
  'isOptional',
  'isActive',
];

@Injectable()
export class HolidayCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PayrollAuditService,
  ) {}

  async listCalendars(organizationId: string, year?: number) {
    return this.prisma.holidayCalendar.findMany({
      where: { organizationId, ...(year ? { year } : {}) },
      include: { holidays: true },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });
  }

  async createCalendar(
    organizationId: string,
    dto: CreateCalendarDto,
    userId: string,
    reason?: string,
  ) {
    if (!dto.name?.trim()) throw new BadRequestException('name is required.');
    if (!Number.isInteger(dto.year) || dto.year < 2000 || dto.year > 2100) {
      throw new BadRequestException('year must be a valid 4-digit year.');
    }
    const existing = await this.prisma.holidayCalendar.findFirst({
      where: { organizationId, name: dto.name, year: dto.year },
    });
    if (existing)
      throw new BadRequestException(
        `A calendar named "${dto.name}" already exists for ${dto.year}.`,
      );
    const created = await this.prisma.holidayCalendar.create({
      data: {
        organizationId,
        name: dto.name,
        year: dto.year,
        state: dto.state,
        location: dto.location,
      },
    });
    await this.audit.recordAction(
      organizationId,
      'HOLIDAY_CALENDAR',
      created.id,
      'CREATE',
      userId,
      reason,
      {
        name: created.name,
        year: created.year,
        state: created.state,
      },
    );
    return created;
  }

  async updateCalendar(
    id: string,
    dto: Partial<CreateCalendarDto>,
    organizationId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to update a holiday calendar.',
      );
    const calendar = await this.prisma.holidayCalendar.findUnique({
      where: { id },
    });
    if (!calendar || calendar.organizationId !== organizationId)
      throw new NotFoundException('Calendar not found.');
    const updated = await this.prisma.holidayCalendar.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.state !== undefined ? { state: dto.state } : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
      },
    });
    await this.audit.recordDiff(
      organizationId,
      'HOLIDAY_CALENDAR',
      id,
      userId,
      reason,
      calendar,
      updated,
      CALENDAR_AUDITED_FIELDS,
    );
    return updated;
  }

  // Soft delete — a calendar already referenced by past PayrollRunSnapshots
  // (via an employee's assignment at calculation time) must never disappear.
  async deactivateCalendar(
    id: string,
    organizationId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException(
        'reason is required to remove a holiday calendar.',
      );
    const calendar = await this.prisma.holidayCalendar.findUnique({
      where: { id },
    });
    if (!calendar || calendar.organizationId !== organizationId)
      throw new NotFoundException('Calendar not found.');
    const updated = await this.prisma.holidayCalendar.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.recordAction(
      organizationId,
      'HOLIDAY_CALENDAR',
      id,
      'DEACTIVATE',
      userId,
      reason,
    );
    return updated;
  }

  async addHoliday(
    calendarId: string,
    dto: CreateHolidayDto,
    organizationId: string,
    userId: string,
    reason?: string,
  ) {
    const calendar = await this.prisma.holidayCalendar.findUnique({
      where: { id: calendarId },
    });
    if (!calendar || calendar.organizationId !== organizationId)
      throw new NotFoundException('Calendar not found.');
    if (!dto.name?.trim())
      throw new BadRequestException('Holiday name is required.');
    const date = new Date(dto.date);
    if (isNaN(date.getTime()))
      throw new BadRequestException('Invalid holiday date.');
    if (date.getFullYear() !== calendar.year) {
      throw new BadRequestException(
        `Holiday date ${dto.date} is not in the calendar's year (${calendar.year}).`,
      );
    }
    const dup = await this.prisma.holiday.findFirst({
      where: { calendarId, date },
    });
    if (dup)
      throw new BadRequestException(
        `A holiday already exists on ${dto.date} in this calendar.`,
      );
    const created = await this.prisma.holiday.create({
      data: {
        calendarId,
        date,
        name: dto.name,
        type: (dto.type as any) ?? 'PUBLIC',
        isPaid: dto.isPaid ?? true,
        isOptional: dto.isOptional ?? false,
      },
    });
    await this.audit.recordAction(
      organizationId,
      'HOLIDAY',
      created.id,
      'CREATE',
      userId,
      reason,
      {
        calendarId,
        date: dto.date,
        name: created.name,
      },
    );
    return created;
  }

  async updateHoliday(
    id: string,
    dto: Partial<CreateHolidayDto>,
    organizationId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException('reason is required to update a holiday.');
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
      include: { calendar: true },
    });
    if (!holiday || holiday.calendar.organizationId !== organizationId) {
      throw new NotFoundException('Holiday not found.');
    }
    const updated = await this.prisma.holiday.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type as any } : {}),
        ...(dto.isPaid !== undefined ? { isPaid: dto.isPaid } : {}),
        ...(dto.isOptional !== undefined ? { isOptional: dto.isOptional } : {}),
      },
    });
    await this.audit.recordDiff(
      organizationId,
      'HOLIDAY',
      id,
      userId,
      reason,
      holiday,
      updated,
      HOLIDAY_AUDITED_FIELDS,
    );
    return updated;
  }

  // Soft delete — a past payroll run's snapshot already froze whatever the
  // holiday map looked like at calculation time, so removing a holiday here
  // only affects future runs.
  async removeHoliday(
    id: string,
    organizationId: string,
    userId: string,
    reason: string,
  ) {
    if (!reason?.trim())
      throw new BadRequestException('reason is required to remove a holiday.');
    const holiday = await this.prisma.holiday.findUnique({
      where: { id },
      include: { calendar: true },
    });
    if (!holiday || holiday.calendar.organizationId !== organizationId) {
      throw new NotFoundException('Holiday not found.');
    }
    const updated = await this.prisma.holiday.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.recordAction(
      organizationId,
      'HOLIDAY',
      id,
      'DEACTIVATE',
      userId,
      reason,
    );
    return updated;
  }

  // Assigns an employee to a calendar, ending any prior active assignment —
  // an employee is assumed to follow exactly one calendar at a time.
  async assignEmployee(
    calendarId: string,
    userId: string,
    organizationId: string,
    actorId: string,
    reason?: string,
  ) {
    const calendar = await this.prisma.holidayCalendar.findUnique({
      where: { id: calendarId },
    });
    if (!calendar || calendar.organizationId !== organizationId)
      throw new NotFoundException('Calendar not found.');

    const now = new Date();
    const priorActive = await this.prisma.holidayCalendarAssignment.findFirst({
      where: { userId, effectiveTo: null },
    });
    if (priorActive) {
      await this.prisma.holidayCalendarAssignment.update({
        where: { id: priorActive.id },
        data: { effectiveTo: now },
      });
      await this.audit.recordAction(
        organizationId,
        'HOLIDAY_ASSIGNMENT',
        priorActive.id,
        'UPDATE',
        actorId,
        reason,
        {
          endedForUserId: userId,
        },
      );
    }
    const assignment = await this.prisma.holidayCalendarAssignment.create({
      data: { calendarId, userId, effectiveFrom: now },
    });
    await this.audit.recordAction(
      organizationId,
      'HOLIDAY_ASSIGNMENT',
      assignment.id,
      'ASSIGN',
      actorId,
      reason,
      {
        calendarId,
        userId,
      },
    );
    return assignment;
  }

  async getAssignedCalendar(userId: string, onDate: Date) {
    const assignment = await this.prisma.holidayCalendarAssignment.findFirst({
      where: {
        userId,
        effectiveFrom: { lte: onDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: onDate } }],
      },
      include: {
        calendar: { include: { holidays: { where: { isActive: true } } } },
      },
    });
    if (assignment?.calendar && !assignment.calendar.isActive) return null;
    return assignment?.calendar ?? null;
  }
}
