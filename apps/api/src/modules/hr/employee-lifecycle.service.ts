import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  buildChecklist,
  ChecklistKind,
  EmployeeFacts,
  isLeaving,
  parseChecklist,
  setTick,
} from './employee-checklist.policy';
import { shiftFrom } from './shift.policy';

const OFFER_LETTERS = [
  'OFFER_LETTER',
  'APPOINTMENT_LETTER',
  'INTERNSHIP_OFFER_LETTER',
];
const NEW_JOINER_DAYS = 90;
const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** Joining/exit checklists, the exit steps, and shift roster for the HR team. */
@Injectable()
export class EmployeeLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private async facts(userIds: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        isActive: true,
        lastLoginAt: true,
        mustChangePassword: true,
        employeeProfile: {
          select: {
            joiningDate: true,
            mobileNumber: true,
            panNumber: true,
            governmentIdsJson: true,
            bankAccountNumber: true,
            bankIfscCode: true,
            bankDetailsJson: true,
            exitDate: true,
            exitReason: true,
            exitInterviewNotes: true,
            ffSettled: true,
            status: true,
            checklistJson: true,
          },
        },
        employeeSalaries: {
          where: { status: 'ACTIVE' },
          select: { id: true },
          take: 1,
        },
        biometricProfiles: {
          where: { status: 'ACTIVE', faceProfile: { isNot: null } },
          select: { id: true },
          take: 1,
        },
        hrDocuments: {
          where: { type: { in: OFFER_LETTERS as any } },
          select: { id: true },
          take: 1,
        },
        officeAssetAssignments: { select: { returnDate: true } },
      },
    });
    return users.map((u) => {
      const p: any = u.employeeProfile || {};
      let bank: any = {};
      let gov: any = {};
      try {
        bank = p.bankDetailsJson ? JSON.parse(p.bankDetailsJson) : {};
      } catch {
        bank = {};
      }
      try {
        gov = p.governmentIdsJson ? JSON.parse(p.governmentIdsJson) : {};
      } catch {
        gov = {};
      }
      const facts: EmployeeFacts = {
        joiningDate: p.joiningDate,
        mobileNumber: p.mobileNumber,
        panNumber: p.panNumber || gov.pan || null,
        hasBank: !!(
          (p.bankAccountNumber || bank.accountNumber) &&
          (p.bankIfscCode || bank.ifscCode)
        ),
        hasSalary: u.employeeSalaries.length > 0,
        faceEnrolled: u.biometricProfiles.length > 0,
        hasSignedIn: !!u.lastLoginAt && !u.mustChangePassword,
        offerLetterIssued: u.hrDocuments.length > 0,
        openAssets: u.officeAssetAssignments.filter((a) => !a.returnDate)
          .length,
        assetsEverIssued: u.officeAssetAssignments.length,
        exitDate: p.exitDate,
        exitInterviewNotes: p.exitInterviewNotes,
        ffSettled: !!p.ffSettled,
        loginActive: u.isActive,
        status: p.status,
      };
      return {
        user: u,
        facts,
        state: parseChecklist(p.checklistJson),
        exitReason: p.exitReason as string | null,
      };
    });
  }

  private view(
    r: Awaited<ReturnType<EmployeeLifecycleService['facts']>>[number],
  ) {
    return {
      employee: {
        id: r.user.id,
        name:
          `${r.user.firstName || ''} ${r.user.lastName || ''}`.trim() ||
          r.user.email,
        email: r.user.email,
      },
      joiningDate: r.facts.joiningDate || null,
      exitDate: r.facts.exitDate || null,
      exitReason: r.exitReason,
      status: r.facts.status || null,
      onboarding: buildChecklist('ONBOARDING', r.facts, r.state),
      offboarding: isLeaving(r.facts)
        ? buildChecklist('OFFBOARDING', r.facts, r.state)
        : null,
    };
  }

  async checklist(userId: string) {
    const [r] = await this.facts([userId]);
    if (!r) throw new NotFoundException('Employee not found');
    return this.view(r);
  }

  /** New joiners (last 90 days or checklist not finished) and everyone on the way out. */
  async overview() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, employeeProfile: { isNot: null } },
      select: { id: true },
    });
    const all = (await this.facts(users.map((u) => u.id))).map((r) =>
      this.view(r),
    );
    const since = Date.now() - NEW_JOINER_DAYS * 86_400_000;
    const joiners = all.filter(
      (v) =>
        !v.offboarding &&
        ((v.joiningDate && new Date(v.joiningDate).getTime() >= since) ||
          v.onboarding.done < v.onboarding.total),
    );
    const leavers = all.filter(
      (v) => v.offboarding && v.offboarding.done < v.offboarding.total,
    );
    const byProgress = (a: any, b: any) => a.done / a.total - b.done / b.total;
    return {
      joiners: joiners.sort((a, b) => byProgress(a.onboarding, b.onboarding)),
      leavers: leavers.sort((a, b) => byProgress(a.offboarding, b.offboarding)),
    };
  }

  async tick(
    userId: string,
    kind: ChecklistKind,
    key: string,
    done: boolean,
    by: { firstName?: string; lastName?: string; email?: string },
  ) {
    if (kind !== 'ONBOARDING' && kind !== 'OFFBOARDING')
      throw new BadRequestException('kind must be ONBOARDING or OFFBOARDING');
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      select: { checklistJson: true },
    });
    if (!profile) throw new NotFoundException('Employee profile not found');
    const who =
      `${by.firstName || ''} ${by.lastName || ''}`.trim() || by.email || 'HR';
    const next = setTick(
      parseChecklist(profile.checklistJson),
      kind,
      key,
      !!done,
      who,
    );
    if (!next)
      throw new BadRequestException(
        'This item ticks itself from the employee record and cannot be ticked by hand',
      );
    await this.prisma.employeeProfile.update({
      where: { userId },
      data: { checklistJson: JSON.stringify(next) },
    });
    return this.checklist(userId);
  }

  /** Starts the exit: last working day, reason and status. The login stays on until HR disables it. */
  async startExit(
    userId: string,
    dto: { lastWorkingDay?: string; reason?: string; status?: string },
  ) {
    const lwd = dto.lastWorkingDay ? new Date(dto.lastWorkingDay) : null;
    if (!lwd || Number.isNaN(lwd.getTime()))
      throw new BadRequestException('Last working day is required');
    const status = ['RESIGNED', 'TERMINATED', 'NOTICE_PERIOD'].includes(
      String(dto.status),
    )
      ? dto.status
      : 'NOTICE_PERIOD';
    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId },
      select: { joiningDate: true },
    });
    if (!profile) throw new NotFoundException('Employee profile not found');
    if (profile.joiningDate && lwd < profile.joiningDate)
      throw new BadRequestException(
        'Last working day is before the joining date',
      );
    await this.prisma.employeeProfile.update({
      where: { userId },
      data: {
        exitDate: lwd,
        exitReason: dto.reason?.trim() || null,
        status: status as any,
      },
    });
    return this.checklist(userId);
  }

  async saveExitInterview(userId: string, notes: string) {
    await this.prisma.employeeProfile.update({
      where: { userId },
      data: { exitInterviewNotes: String(notes || '').trim() || null },
    });
    return this.checklist(userId);
  }

  /** Turns the login off and ends every session now; the record and history stay. */
  async disableLogin(userId: string, actorId: string) {
    if (userId === actorId)
      throw new BadRequestException('You cannot disable your own login');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Employee not found');
    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false, tokenVersion: { increment: 1 } },
    });
    return this.checklist(userId);
  }

  // ─── Shift roster ──────────────────────────────────────────────────────────

  async roster() {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        employeeProfile: { isNot: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        employeeProfile: {
          select: {
            attendanceSettingsJson: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });
    return users.map((u) => {
      let name: string | null = null;
      try {
        name =
          JSON.parse(u.employeeProfile?.attendanceSettingsJson || '{}')
            ?.shift || null;
      } catch {
        name = null;
      }
      return {
        id: u.id,
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
        department: u.employeeProfile?.department?.name || null,
        shiftName: name,
        ...shiftFrom(u.employeeProfile?.attendanceSettingsJson),
      };
    });
  }

  /** Puts the chosen employees on one shift, keeping their other attendance settings. */
  async assignShift(dto: {
    userIds?: string[];
    shiftName?: string;
    start?: string;
    end?: string;
    graceMins?: number;
    weeklyOff?: string[];
  }) {
    const ids = Array.isArray(dto.userIds)
      ? dto.userIds.filter((x) => typeof x === 'string')
      : [];
    if (!ids.length)
      throw new BadRequestException('Choose at least one employee');
    if (!HHMM.test(String(dto.start)) || !HHMM.test(String(dto.end)))
      throw new BadRequestException('Shift start and end must be HH:MM');
    const grace = Math.round(Number(dto.graceMins ?? 15));
    if (!Number.isFinite(grace) || grace < 0 || grace > 240)
      throw new BadRequestException('Grace period must be 0 to 240 minutes');
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    const weeklyOff = (dto.weeklyOff || []).filter((d) => days.includes(d));
    const profiles = await this.prisma.employeeProfile.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, attendanceSettingsJson: true },
    });
    for (const p of profiles) {
      let s: any = {};
      try {
        s = p.attendanceSettingsJson
          ? JSON.parse(p.attendanceSettingsJson)
          : {};
      } catch {
        s = {};
      }
      const next = {
        ...(s && typeof s === 'object' ? s : {}),
        shift: dto.shiftName?.trim() || `${dto.start} - ${dto.end}`,
        shiftStartTime: dto.start,
        shiftEndTime: dto.end,
        gracePeriodMins: String(grace),
        weeklyOff: weeklyOff.join(', '),
      };
      await this.prisma.employeeProfile.update({
        where: { userId: p.userId },
        data: { attendanceSettingsJson: JSON.stringify(next) },
      });
    }
    return { updated: profiles.length };
  }
}
