import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CompanyProfileService } from '../company-profile/company-profile.service';
import {
  GenerateHrDocumentDto,
  LogAttendanceDto,
  CreateLeaveRequestDto,
  UpdateLeaveStatusDto,
  CreateEmployeeDto,
  UpdateEmployeeDto,
} from './dto';
import {
  EmploymentType,
  HrDocumentType,
  HrDocumentStatus,
  AttendanceStatus,
  LeaveStatus,
  RoleField,
  LeaveType,
  LeaveDurationType,
  HalfDaySlot,
  ReferenceType,
  LeaveTransactionType,
  SandwichPolicy,
  HolidayType,
  Prisma,
} from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AUTO_ROLE_NAMES,
  INVITE_VALID_DAYS,
  inviteUrl,
  newInvite,
  publicUser,
  rbacRolesFor,
  temporaryPassword,
} from './employee-access.policy';
import {
  FACE_CHECK_WINDOW_MS,
  joinNotes,
  selfPunchNote,
} from './attendance-proof.policy';
import { geofenceNote } from './geofence.policy';
import { clockInVerdict, clockOutNote, shiftFrom } from './shift.policy';
import * as bcrypt from 'bcrypt';
const parseOptionalDate = (val: any): Date | null | undefined => {
  if (val === undefined) return undefined;
  if (val === null || val === '') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const parseCreateDate = (val: any): Date | undefined => {
  if (!val) return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
};

@Injectable()
export class HrService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly notificationsService: NotificationsService,
    private readonly companyProfileService: CompanyProfileService,
  ) {}

  // ─── Employee Directory ───────────────────────────────────────────────────

  async listEmployees(
    query: { search?: string; type?: EmploymentType },
    callerUser?: any,
  ) {
    const isCustomer = callerUser?.userType === 'CUSTOMER';
    const where: any = {
      role: { not: 'CLIENT' },
      deletedAt: null,
      ...(isCustomer
        ? {
            userType: 'CUSTOMER',
            OR: [
              { activeOrganizationId: callerUser.activeOrganizationId },
              { organizationId: callerUser.activeOrganizationId },
              {
                organizationMembers: {
                  some: { organizationId: callerUser.activeOrganizationId },
                },
              },
            ],
          }
        : {
            userType: 'STAFF',
          }),
    };

    if (query.type) {
      where.employmentType = query.type;
    }

    if (query.search) {
      const searchCondition = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchCondition }];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    const employees = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        employmentType: true,
        isActive: true,
        createdAt: true,
        employeeProfile: {
          include: {
            department: true,
            designation: true,
            branch: true,
          },
        },
        employeeSalaries: {
          where: { status: 'ACTIVE' },
          take: 1,
        },
        _count: {
          select: {
            hrDocuments: true,
            attendanceRecords: true,
            leaveRequests: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return employees;
  }

  async createEmployee(dto: CreateEmployeeDto, callerUser?: any) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing && existing.deletedAt === null) {
      throw new BadRequestException('Email is already registered');
    }
    if (existing && existing.deletedAt !== null) {
      throw new BadRequestException(
        'This email belongs to a previously removed employee record. Ask a super admin to permanently delete or restore that record before re-adding this email.',
      );
    }

    // No shared default password: without one from HR, each employee gets their own temporary password,
    // shown once to HR in this response.
    const tempPassword = dto.password ? null : temporaryPassword();
    const passwordHash = await bcrypt.hash(dto.password || tempPassword!, 10);

    // salary object comes from packPayload (frontend), falls back to top-level dto for backward compat
    const sd = (dto as any).salary || dto;
    const empType: string = (dto as any).employmentType || 'EMPLOYEE';

    // PF defaults by type
    const pfApplicable = sd.pfApplicable === true || sd.pfApplicable === 'true';
    const esiApplicable =
      sd.esiApplicable === true || sd.esiApplicable === 'true';

    const salaryData: any = {
      effectiveFrom: parseCreateDate(dto.joiningDate) || new Date(),
      ctc: Number(sd.ctc || 0),
      basicSalary: Number(sd.basicSalary || 0),
      hra: Number(sd.hra || 0),
      conveyanceAllowance: Number(
        sd.conveyanceAllowance ?? (empType === 'EMPLOYEE' ? 1600 : 0),
      ),
      specialAllowance: Number(sd.specialAllowance || 0),
      performanceIncentive: Number(sd.performanceIncentive || 0),
      daAllowance: Number(sd.daAllowance || 0),
      otherAllowance: Number(sd.allowance || sd.otherAllowance || 0),
      // PF
      pfApplicable,
      pfWageCeiling: Number(sd.pfWageCeiling ?? 15000),
      voluntaryPfPercent: Number(sd.voluntaryPfPercent ?? 0),
      employerPfApplicable: sd.employerPfApplicable !== false,
      pfNumber: sd.pfNumber || null,
      // ESI
      esiApplicable,
      esiGrossCeiling: Number(sd.esiGrossCeiling ?? 21000),
      esiNumber: sd.esiNumber || null,
      // PT (null = auto Karnataka slab)
      professionalTaxOverride:
        sd.professionalTaxOverride !== undefined &&
        sd.professionalTaxOverride !== null &&
        sd.professionalTaxOverride !== ''
          ? Number(sd.professionalTaxOverride)
          : empType === 'PAID_INTERN' || empType === 'UNPAID_INTERN'
            ? 0
            : null,
      // Other deductions
      tds: Number(sd.tds || 0),
      gisDeduction: Number(sd.gisDeduction || 0),
      npsEmployee: Number(sd.npsEmployee || 0),
      otherDeductions: Number(sd.otherDeductions || 0),
      // Classification
      employmentCategory: sd.employmentCategory || empType,
      taxRegime: sd.taxRegime || 'NEW',
      salaryCycle: sd.salaryCycle || 'Monthly',
      paymentMode: sd.paymentMode || 'Bank Transfer',
      status: 'ACTIVE',
    };

    // Tie the employee to the organization
    const isCustomer = callerUser?.userType === 'CUSTOMER';
    const orgId = isCustomer
      ? callerUser.activeOrganizationId
      : (await this.prisma.organization
          .findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
          .then((o) => o?.id)
          .catch(() => null));

    const invite = newInvite();
    const user = await this.prisma.user.create({
      data: {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(isCustomer
          ? { activeOrganizationId: orgId, userType: 'CUSTOMER' }
          : { userType: 'STAFF' }),
        // Until they set their own password (invite link or first login), the app asks for one.
        mustChangePassword: !dto.password,
        inviteTokenHash: invite.tokenHash,
        inviteExpiresAt: invite.expiresAt,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        role: dto.role || RoleField.DEVELOPER,
        employmentType: dto.employmentType || 'EMPLOYEE',
        isActive: true,
        ...(isCustomer && orgId
          ? {
              organizationMembers: {
                create: {
                  organizationId: orgId,
                  role: 'MEMBER',
                },
              },
            }
          : {}),
        employeeProfile: {
          create: {
            middleName: dto.middleName,
            gender: dto.gender,
            dateOfBirth: parseCreateDate(dto.dateOfBirth),
            bloodGroup: dto.bloodGroup,
            maritalStatus: dto.maritalStatus,
            personalEmail: dto.personalEmail,
            mobileNumber: dto.mobileNumber,
            alternateMobile: dto.alternateMobile,
            emergencyContactName: dto.emergencyContactName,
            emergencyContactNumber: dto.emergencyContactNumber,
            relationship: dto.relationship,
            joiningDate: parseCreateDate(dto.joiningDate),
            departmentId: dto.departmentId || undefined,
            designationId: dto.designationId || undefined,
            branchId: dto.branchId || undefined,
            noticePeriodDays: Number(dto.noticePeriodDays || 30),
            costCenter: dto.costCenter,
            grade: dto.grade,
            reportingManager: dto.reportingManager,
            workLocation: dto.workLocation,
            addressJson: dto.addressJson,
            governmentIdsJson: dto.governmentIdsJson,
            bankDetailsJson: dto.bankDetailsJson,
            bankHolderName: dto.bankHolderName,
            bankName: dto.bankName,
            bankAccountNumber: dto.bankAccountNumber,
            bankIfscCode: dto.bankIfscCode,
            bankBranchName: dto.bankBranchName,
            aadhaarNumber: dto.aadhaarNumber,
            panNumber: dto.panNumber,
            pranNumber: dto.pranNumber,
            attendanceSettingsJson: dto.attendanceSettingsJson,
            leaveSettingsJson: dto.leaveSettingsJson,
            assetsJson: dto.assetsJson,
            educationJson: dto.educationJson,
            experienceJson: dto.experienceJson,
            skillsJson: dto.skillsJson,
            documentsJson: dto.documentsJson,
          },
        },
        employeeSalaries: {
          create: [salaryData],
        },
      },
      include: { employeeProfile: true, employeeSalaries: true },
    });

    await this.syncPermissionRoles(user.id, user.role);
    const inviteSent = await this.sendInvite(user, invite.token);
    const {
      inviteTokenHash: _t,
      inviteExpiresAt: _e,
      ...safe
    } = publicUser(user) as any;
    return {
      ...safe,
      inviteSent,
      ...(tempPassword ? { temporaryPassword: tempPassword } : {}),
    };
  }

  /**
   * Gives an employee the permission roles that match their job role (plus the base employee role),
   * so a new developer can see their tasks and projects without someone assigning roles by hand.
   * Only the automatic roles are touched; custom roles given in Settings > Roles stay.
   */
  async syncPermissionRoles(
    userId: string,
    role: string | null | undefined,
    previousRole?: string | null,
  ): Promise<void> {
    const wanted = rbacRolesFor(role);
    const roles = await this.prisma.role.findMany({
      where: { name: { in: AUTO_ROLE_NAMES } },
      select: { id: true, name: true },
    });
    const keep = roles.filter((r) => wanted.includes(r.name)).map((r) => r.id);
    // On a role change only the old job role goes; extra roles given by hand stay.
    const drop = roles
      .filter((r) => r.name === previousRole && !wanted.includes(r.name))
      .map((r) => r.id);
    if (drop.length)
      await this.prisma.userRole.deleteMany({
        where: { userId, roleId: { in: drop } },
      });
    for (const roleId of keep) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId } },
        create: { userId, roleId },
        update: {},
      });
    }
  }

  /** Emails the welcome with the "set your password" link. Never fails the caller: HR also has the one-time password. */
  private async sendInvite(
    user: { email: string; firstName: string },
    token: string,
  ): Promise<boolean> {
    try {
      const company = await this.companyProfileService
        .get()
        .catch(() => null as any);
      await this.notificationsService.queueEmail(
        user.email,
        'employee_invite',
        {
          email: user.email,
          firstName: user.firstName,
          companyName: company?.companyName || 'NeuraVolt',
          inviteUrl: inviteUrl(token),
          validDays: INVITE_VALID_DAYS,
          ctaUrl: inviteUrl(token),
          ctaLabel: 'Set your password',
        },
        `Welcome to ${company?.companyName || 'NeuraVolt'}: set your workspace password`,
      );
      return true;
    } catch (err: any) {
      console.warn(
        `[HR] Invite email to ${user.email} not queued: ${err?.message}`,
      );
      return false;
    }
  }

  /** HR sends a fresh invite link (the old one stops working). */
  async resendInvite(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, email: true, firstName: true },
    });
    if (!user) throw new NotFoundException(`Employee ${id} not found`);
    const invite = newInvite();
    await this.prisma.user.update({
      where: { id },
      data: {
        inviteTokenHash: invite.tokenHash,
        inviteExpiresAt: invite.expiresAt,
      },
    });
    return {
      inviteSent: await this.sendInvite(user, invite.token),
      expiresAt: invite.expiresAt,
    };
  }

  async updateEmployee(id: string, dto: UpdateEmployeeDto) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`Employee ${id} not found`);

    const updateData: any = {};
    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.role) updateData.role = dto.role;
    if (dto.role && dto.role !== user.role)
      await this.syncPermissionRoles(id, dto.role, user.role);
    if (dto.employmentType) updateData.employmentType = dto.employmentType;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.avatarUrl !== undefined) updateData.avatarUrl = dto.avatarUrl;

    await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    const profileData: any = {};
    if (dto.middleName !== undefined) profileData.middleName = dto.middleName;
    if (dto.gender !== undefined) profileData.gender = dto.gender;
    if (dto.dateOfBirth !== undefined)
      profileData.dateOfBirth = parseOptionalDate(dto.dateOfBirth);
    if (dto.bloodGroup !== undefined) profileData.bloodGroup = dto.bloodGroup;
    if (dto.maritalStatus !== undefined)
      profileData.maritalStatus = dto.maritalStatus;
    if (dto.personalEmail !== undefined)
      profileData.personalEmail = dto.personalEmail;
    if (dto.mobileNumber !== undefined)
      profileData.mobileNumber = dto.mobileNumber;
    if (dto.alternateMobile !== undefined)
      profileData.alternateMobile = dto.alternateMobile;
    if (dto.emergencyContactName !== undefined)
      profileData.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactNumber !== undefined)
      profileData.emergencyContactNumber = dto.emergencyContactNumber;
    if (dto.relationship !== undefined)
      profileData.relationship = dto.relationship;
    if (dto.joiningDate !== undefined)
      profileData.joiningDate = parseOptionalDate(dto.joiningDate);
    if (dto.departmentId !== undefined)
      profileData.departmentId = dto.departmentId || null;
    if (dto.designationId !== undefined)
      profileData.designationId = dto.designationId || null;
    if (dto.branchId !== undefined) profileData.branchId = dto.branchId || null;
    if (dto.noticePeriodDays !== undefined)
      profileData.noticePeriodDays = Number(dto.noticePeriodDays || 30);
    if (dto.costCenter !== undefined) profileData.costCenter = dto.costCenter;
    if (dto.grade !== undefined) profileData.grade = dto.grade;
    if (dto.reportingManager !== undefined)
      profileData.reportingManager = dto.reportingManager;
    if (dto.workLocation !== undefined)
      profileData.workLocation = dto.workLocation;
    if (dto.addressJson !== undefined)
      profileData.addressJson = dto.addressJson;
    if (dto.governmentIdsJson !== undefined)
      profileData.governmentIdsJson = dto.governmentIdsJson;
    if (dto.bankDetailsJson !== undefined)
      profileData.bankDetailsJson = dto.bankDetailsJson;
    if (dto.bankHolderName !== undefined)
      profileData.bankHolderName = dto.bankHolderName;
    if (dto.bankName !== undefined) profileData.bankName = dto.bankName;
    if (dto.bankAccountNumber !== undefined)
      profileData.bankAccountNumber = dto.bankAccountNumber;
    if (dto.bankIfscCode !== undefined)
      profileData.bankIfscCode = dto.bankIfscCode;
    if (dto.bankBranchName !== undefined)
      profileData.bankBranchName = dto.bankBranchName;
    if (dto.aadhaarNumber !== undefined)
      profileData.aadhaarNumber = dto.aadhaarNumber;
    if (dto.panNumber !== undefined) profileData.panNumber = dto.panNumber;
    if (dto.pranNumber !== undefined) profileData.pranNumber = dto.pranNumber;
    if (dto.attendanceSettingsJson !== undefined)
      profileData.attendanceSettingsJson = dto.attendanceSettingsJson;
    if (dto.leaveSettingsJson !== undefined)
      profileData.leaveSettingsJson = dto.leaveSettingsJson;
    if (dto.assetsJson !== undefined) profileData.assetsJson = dto.assetsJson;
    if (dto.educationJson !== undefined)
      profileData.educationJson = dto.educationJson;
    if (dto.experienceJson !== undefined)
      profileData.experienceJson = dto.experienceJson;
    if (dto.skillsJson !== undefined) profileData.skillsJson = dto.skillsJson;
    if (dto.documentsJson !== undefined)
      profileData.documentsJson = dto.documentsJson;
    if (dto.status !== undefined) profileData.status = dto.status;

    // Exit Details fields mapping
    if (dto.exitDate !== undefined)
      profileData.exitDate = parseOptionalDate(dto.exitDate);
    if (dto.exitReason !== undefined) profileData.exitReason = dto.exitReason;
    if (dto.exitInterviewNotes !== undefined)
      profileData.exitInterviewNotes = dto.exitInterviewNotes;
    if (dto.ffSettled !== undefined)
      profileData.ffSettled =
        dto.ffSettled === true || dto.ffSettled === 'true';

    const anyDto = dto as any;
    if (anyDto.avatarUrl !== undefined || anyDto.photoUrl !== undefined) {
      const avatarUrl = anyDto.avatarUrl || anyDto.photoUrl;
      await this.prisma.user.update({
        where: { id },
        data: { avatarUrl },
      });
    }

    await this.prisma.employeeProfile.upsert({
      where: { userId: id },
      create: { userId: id, ...profileData },
      update: profileData,
    });

    // salary object from packPayload (frontend) or fallback to top-level dto fields
    const sd = (dto as any).salary;
    const hasSalaryChanges =
      sd?.basicSalary !== undefined ||
      dto.ctc !== undefined ||
      dto.basicSalary !== undefined ||
      dto.hra !== undefined ||
      (dto as any).pfApplicable !== undefined ||
      (dto as any).esiApplicable !== undefined ||
      (dto as any).tds !== undefined ||
      (dto as any).salaryCycle !== undefined;

    if (hasSalaryChanges) {
      const activeSalary = await this.prisma.employeeSalary.findFirst({
        where: { userId: id, status: 'ACTIVE' },
      });

      // Build salary patch from sd (new object) OR dto top-level (legacy)
      const src = sd || dto;
      const empType =
        (dto as any).employmentType || user.employmentType || 'EMPLOYEE';
      const salaryData: any = {};

      if (src.ctc !== undefined) salaryData.ctc = Number(src.ctc || 0);
      if (src.basicSalary !== undefined)
        salaryData.basicSalary = Number(src.basicSalary || 0);
      if (src.hra !== undefined) salaryData.hra = Number(src.hra || 0);
      if (src.conveyanceAllowance !== undefined)
        salaryData.conveyanceAllowance = Number(src.conveyanceAllowance ?? 0);
      if (src.specialAllowance !== undefined)
        salaryData.specialAllowance = Number(src.specialAllowance || 0);
      if (src.performanceIncentive !== undefined)
        salaryData.performanceIncentive = Number(src.performanceIncentive || 0);
      if (src.daAllowance !== undefined)
        salaryData.daAllowance = Number(src.daAllowance || 0);
      if (src.allowance !== undefined || src.otherAllowance !== undefined)
        salaryData.otherAllowance = Number(
          src.otherAllowance || src.allowance || 0,
        );
      // PF
      if (src.pfApplicable !== undefined)
        salaryData.pfApplicable =
          src.pfApplicable === true || src.pfApplicable === 'true';
      if (src.pfWageCeiling !== undefined)
        salaryData.pfWageCeiling = Number(src.pfWageCeiling ?? 15000);
      if (src.voluntaryPfPercent !== undefined)
        salaryData.voluntaryPfPercent = Number(src.voluntaryPfPercent ?? 0);
      if (src.pfNumber !== undefined)
        salaryData.pfNumber = src.pfNumber || null;
      // ESI
      if (src.esiApplicable !== undefined)
        salaryData.esiApplicable =
          src.esiApplicable === true || src.esiApplicable === 'true';
      if (src.esiGrossCeiling !== undefined)
        salaryData.esiGrossCeiling = Number(src.esiGrossCeiling ?? 21000);
      if (src.esiNumber !== undefined)
        salaryData.esiNumber = src.esiNumber || null;
      // PT override (null = auto Karnataka slab)
      if ('professionalTaxOverride' in src) {
        salaryData.professionalTaxOverride =
          src.professionalTaxOverride !== null &&
          src.professionalTaxOverride !== '' &&
          src.professionalTaxOverride !== undefined
            ? Number(src.professionalTaxOverride)
            : null;
      } else if (src.professionalTax !== undefined) {
        // legacy field: treat as override
        salaryData.professionalTaxOverride = Number(src.professionalTax || 0);
      }
      // Other
      if (src.tds !== undefined) salaryData.tds = Number(src.tds || 0);
      if (src.gisDeduction !== undefined)
        salaryData.gisDeduction = Number(src.gisDeduction || 0);
      if (src.npsEmployee !== undefined)
        salaryData.npsEmployee = Number(src.npsEmployee || 0);
      if (src.otherDeductions !== undefined)
        salaryData.otherDeductions = Number(src.otherDeductions || 0);
      if (src.taxRegime !== undefined) salaryData.taxRegime = src.taxRegime;
      if (src.salaryCycle !== undefined)
        salaryData.salaryCycle = src.salaryCycle;
      if (src.paymentMode !== undefined)
        salaryData.paymentMode = src.paymentMode;
      if (src.employmentCategory !== undefined)
        salaryData.employmentCategory = src.employmentCategory;
      else if (empType) salaryData.employmentCategory = empType;

      if (activeSalary) {
        await this.prisma.employeeSalary.update({
          where: { id: activeSalary.id },
          data: salaryData,
        });
      } else {
        await this.prisma.employeeSalary.create({
          data: {
            userId: id,
            effectiveFrom:
              parseCreateDate((dto as any).joiningDate) || new Date(),
            status: 'ACTIVE',
            ctc: 0,
            basicSalary: 0,
            hra: 0,
            ...salaryData,
          },
        });
      }
    }

    return { message: 'Employee updated successfully' };
  }

  async deleteEmployee(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`Employee ${id} not found`);

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    return {
      message: 'Employee terminated and removed from directory successfully',
    };
  }

  async permanentDeleteEmployee(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException(`Employee ${id} not found`);

    // Delete cascading user relations first if any
    await this.prisma.userRole.deleteMany({ where: { userId: id } });
    await this.prisma.employeeProfile.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });

    return { message: 'Employee permanently deleted from system' };
  }

  async updateEmploymentType(id: string, employmentType: EmploymentType) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
    });
    if (!user) throw new NotFoundException(`Employee ${id} not found`);

    return this.prisma.user.update({
      where: { id },
      data: { employmentType },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        employmentType: true,
      },
    });
  }

  // ─── Documents Management ─────────────────────────────────────────────────

  /**
   * Absolute path of a generated HR document PDF, for the authenticated download route.
   * Only HR admins or the employee the document belongs to may read it.
   */
  async getDocumentFileForUser(
    id: string,
    user: { id: string },
    isAdmin: boolean,
  ) {
    const doc = await this.prisma.hrDocument.findUnique({
      where: { id },
      select: { id: true, employeeId: true, filePath: true, type: true },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    if (!isAdmin && doc.employeeId !== user.id) {
      throw new ForbiddenException('You can only download your own documents');
    }
    if (!doc.filePath)
      throw new BadRequestException(
        'Document PDF file has not been compiled yet',
      );

    const storageDir = process.env.STORAGE_PATH || './uploads';
    const fullPath = path.resolve(
      storageDir,
      'hr-documents',
      path.basename(doc.filePath),
    );
    if (!fs.existsSync(fullPath))
      throw new NotFoundException('PDF file not found on server storage');
    return { fullPath, fileName: `${doc.type}-${doc.id}.pdf` };
  }

  async listDocuments(query: { employeeId?: string; type?: HrDocumentType }) {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.type) where.type = query.type;

    return this.prisma.hrDocument.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async generateDocument(dto: GenerateHrDocumentDto) {
    const employee = await this.prisma.user.findUnique({
      where: { id: dto.employeeId, deletedAt: null },
    });
    if (!employee)
      throw new NotFoundException(`Employee ${dto.employeeId} not found`);

    const company = await this.companyProfileService.get();

    // 1. Generate text body based on the document type
    let textContent = '';
    const startDateObj = parseCreateDate(dto.startDate);
    const endDateObj = parseCreateDate(dto.endDate);
    const startStr = startDateObj
      ? startDateObj.toLocaleDateString('en-IN')
      : 'TBD';
    const endStr = endDateObj ? endDateObj.toLocaleDateString('en-IN') : 'TBD';
    const basicFmt = dto.basicSalary
      ? `₹${dto.basicSalary.toLocaleString('en-IN')}`
      : 'TBD';
    const stipendFmt = dto.basicSalary
      ? `₹${dto.basicSalary.toLocaleString('en-IN')}`
      : 'TBD';

    switch (dto.type) {
      case HrDocumentType.OFFER_LETTER:
        textContent = `Dear ${employee.firstName} ${employee.lastName},\n\nWe are pleased to offer you the position of Employee at ${company.companyName}. We were extremely impressed by your credentials and look forward to welcoming you to our team.\n\nYour employment will commence on ${startStr}.\nYour starting salary will be basic pay of ${basicFmt} per month, subject to standard taxes and deductions.\n\nPlease sign below to confirm your acceptance of this offer.\n\nSincerely,\n${company.companyName} Management`;
        break;
      case HrDocumentType.APPOINTMENT_LETTER:
        textContent = `Dear ${employee.firstName} ${employee.lastName},\n\nFollowing your acceptance of our offer, we are pleased to appoint you as a full-time Employee at ${company.companyName} starting from ${startStr}.\n\nYou will be on probation for a period of six months. Your roles and responsibilities will align with your department assignment.\n\nWelcome to ${company.companyName}!`;
        break;
      case HrDocumentType.NDA:
        textContent = `NON-DISCLOSURE AGREEMENT (NDA)\n\nThis Agreement is made between ${company.companyName} and employee ${employee.firstName} ${employee.lastName}.\n\nThe employee agrees to hold all proprietary or confidential information, code repositories, credentials, client lists, and intellectual property of ${company.companyName} in strict confidence and shall not disclose it to any third party during or after their employment.`;
        break;
      case HrDocumentType.SALARY_STRUCTURE:
        textContent = `SALARY STRUCTURE DETAILS\n\nEmployee Name: ${employee.firstName} ${employee.lastName}\nEffective Date: ${startStr}\n\nComponents Breakdown:\n- Basic Salary: ${basicFmt} / Month\n- HRA & Allowances: ₹${(dto.allowances || 0).toLocaleString('en-IN')} / Month\n- Deductions: ₹${(dto.deductions || 0).toLocaleString('en-IN')} / Month\n\nTotal Gross Salary: ₹${((dto.basicSalary || 0) + (dto.allowances || 0)).toLocaleString('en-IN')} / Month`;
        break;
      case HrDocumentType.INTERNSHIP_OFFER_LETTER:
        textContent = `Dear ${employee.firstName} ${employee.lastName},\n\nWe are pleased to offer you an Internship position at ${company.companyName}.\n\nThe duration of this internship will be from ${startStr} to ${endStr}.\nAs an unpaid intern, you will receive mentoring, guidance, and hands-on industry experience. You will not receive any financial stipend.\n\nWe look forward to working with you!`;
        break;
      case HrDocumentType.INTERNSHIP_COMPLETION_CERTIFICATE:
        textContent = `TO WHOM IT MAY CONCERN\n\nThis is to certify that ${employee.firstName} ${employee.lastName} has successfully completed their internship at ${company.companyName} from ${startStr} to ${endStr}.\n\nDuring their tenure, they worked on key assignments with dedication and diligence. We wish them all success in their future career.`;
        break;
      case HrDocumentType.CONFIDENTIALITY_CLAUSE:
        textContent = `CONFIDENTIALITY AGREEMENT\n\nThe Intern (${employee.firstName} ${employee.lastName}) agrees that all software code, client records, and technical specs of ${company.companyName} accessed during their internship are strictly confidential and must not be copied, shared, or compiled outside company servers.`;
        break;
      case HrDocumentType.INTERNSHIP_AGREEMENT:
        textContent = `INTERNSHIP AGREEMENT\n\nThis agreement details the Paid Internship parameters for ${employee.firstName} ${employee.lastName}.\n\nDuration: ${startStr} to ${endStr}\nStipend Rate: ${stipendFmt} per month, payable upon monthly progress reviews.\nIntellectual Property: All code written during the internship belongs solely to ${company.companyName}.`;
        break;
      case HrDocumentType.MONTHLY_STIPEND_RECORD:
        textContent = `MONTHLY STIPEND RECORD\n\nIntern Name: ${employee.firstName} ${employee.lastName}\nPeriod: ${startStr} to ${endStr}\nMonthly Stipend: ${stipendFmt}\nStatus: Paid`;
        break;
      case HrDocumentType.PAYMENT_PROOF:
        textContent = `PAYMENT PROOF ACKNOWLEDGEMENT\n\nThis certifies that payment of ${stipendFmt} has been disbursed to ${employee.firstName} ${employee.lastName} on ${startStr} via Bank Transfer.`;
        break;
      default:
        textContent =
          dto.notes ||
          `HR Document for ${employee.firstName} ${employee.lastName}`;
    }

    // 2. Create DB record first to get ID
    const title =
      dto.title || `${dto.type.replace(/_/g, ' ')} - ${employee.firstName}`;
    const doc = await this.prisma.hrDocument.create({
      data: {
        employeeId: dto.employeeId,
        type: dto.type,
        status: HrDocumentStatus.DRAFT,
        title,
        notes: dto.notes,
      },
    });

    // 3. Compile PDF using PdfService
    let pdfBuffer: Buffer;
    if (dto.type === HrDocumentType.SALARY_SLIP) {
      // Auto-prefill workingDays from attendance logs if not specified
      if (!dto.workingDays) {
        const startMonth =
          (parseCreateDate(dto.startDate) || new Date()).getMonth() + 1;
        const startYear = (
          parseCreateDate(dto.startDate) || new Date()
        ).getFullYear();
        const firstDay = new Date(startYear, startMonth - 1, 1);
        const lastDay = new Date(startYear, startMonth, 0);

        const attendanceCount = await this.prisma.attendance.count({
          where: {
            employeeId: dto.employeeId,
            date: { gte: firstDay, lte: lastDay },
            status: { in: ['PRESENT', 'HALF_DAY', 'LATE'] },
          },
        });
        dto.workingDays = attendanceCount > 0 ? attendanceCount : 30.0;
      }

      // Create a temporary salary entry to compile or use parameters
      const tempSalaryEntry = await this.prisma.salaryEntry.create({
        data: {
          employeeId: dto.employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          month: (parseCreateDate(dto.startDate) || new Date()).getMonth() + 1,
          year: (parseCreateDate(dto.startDate) || new Date()).getFullYear(),
          basicSalary: dto.basicSalary || 0,
          allowances: dto.allowances || 0,
          deductions: dto.deductions || 0,
          netPay:
            (dto.basicSalary || 0) +
            (dto.allowances || 0) -
            (dto.deductions || 0),
          notes: dto.notes,
        },
      });
      pdfBuffer = await this.pdfService.generateSalarySlipPdf(
        tempSalaryEntry.id,
        dto,
      );
    } else {
      pdfBuffer = await this.pdfService.generateHrDocumentPdf(doc.id, {
        content: textContent,
      });
    }

    // 4. Save to uploads disk folder
    const storageDir = process.env.STORAGE_PATH || './uploads';
    const hrDocsDir = path.join(storageDir, 'hr-documents');
    if (!fs.existsSync(hrDocsDir)) {
      fs.mkdirSync(hrDocsDir, { recursive: true });
    }

    const filename = `${doc.id}.pdf`;
    const destPath = path.join(hrDocsDir, filename);
    fs.writeFileSync(destPath, pdfBuffer);

    // 5. Update DB record with file path
    const filePath = `/uploads/hr-documents/${filename}`;
    return this.prisma.hrDocument.update({
      where: { id: doc.id },
      data: { filePath },
    });
  }

  async sendDocument(id: string) {
    const doc = await this.prisma.hrDocument.findUnique({
      where: { id },
      include: { employee: true },
    });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);
    if (!doc.filePath)
      throw new BadRequestException(
        `Document PDF file has not been compiled yet`,
      );

    // Read PDF file from disk
    const storageDir = process.env.STORAGE_PATH || './uploads';
    const filename = path.basename(doc.filePath);
    const fullPath = path.join(storageDir, 'hr-documents', filename);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(
        `PDF file not found on server storage: ${fullPath}`,
      );
    }

    const pdfBuffer = fs.readFileSync(fullPath);

    // Queue email with attachment
    await this.notificationsService.queueEmail(
      doc.employee.email,
      'hr_document_sent',
      {
        employeeName: `${doc.employee.firstName} ${doc.employee.lastName}`,
        documentTitle: doc.title,
      },
      `Important HR Document: ${doc.title}`,
      [
        {
          filename: `${doc.title.replace(/\s+/g, '_')}.pdf`,
          content: pdfBuffer.toString('base64'),
          contentType: 'application/pdf',
        },
      ],
    );

    // Update status in DB
    return this.prisma.hrDocument.update({
      where: { id },
      data: { status: HrDocumentStatus.SENT, sentAt: new Date() },
    });
  }

  async deleteDocument(id: string) {
    const doc = await this.prisma.hrDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException(`Document ${id} not found`);

    // Remove PDF from disk if it exists
    if (doc.filePath) {
      const storageDir = process.env.STORAGE_PATH || './uploads';
      const filename = path.basename(doc.filePath);
      const fullPath = path.join(storageDir, 'hr-documents', filename);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.error(`Failed to delete PDF from disk: ${fullPath}`, e);
        }
      }
    }

    return this.prisma.hrDocument.delete({ where: { id } });
  }

  // ─── Attendance Register ──────────────────────────────────────────────────

  async listAttendance(query: {
    employeeId?: string;
    year?: number;
    month?: number;
    startDate?: string;
    endDate?: string;
    departmentId?: string;
    branchId?: string;
    status?: string;
    search?: string;
  }) {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;

    if (query.startDate && query.endDate) {
      const start = new Date(query.startDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(query.endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    } else if (query.year && query.month) {
      const start = new Date(query.year, query.month - 1, 1);
      const end = new Date(query.year, query.month, 0, 23, 59, 59);
      where.date = { gte: start, lte: end };
    }

    if (query.status && query.status !== 'ALL') {
      if (query.status === 'FLAGGED') {
        where.notes = { contains: 'PROXY ALERT' };
      } else {
        where.status = query.status;
      }
    }

    if (query.departmentId || query.branchId || query.search) {
      const userConditions: any[] = [];
      if (query.search) {
        userConditions.push({
          OR: [
            { firstName: { contains: query.search, mode: 'insensitive' } },
            { lastName: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
          ],
        });
      }

      if (query.departmentId || query.branchId) {
        const profileWhere: any = {};
        if (query.departmentId) profileWhere.departmentId = query.departmentId;
        if (query.branchId) profileWhere.branchId = query.branchId;
        userConditions.push({
          employeeProfile: profileWhere,
        });
      }

      where.employee = { AND: userConditions };
    }

    return this.prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            biometricProfiles: {
              select: {
                faceProfile: {
                  select: { profilePhotoUrl: true },
                },
              },
            },
            employeeProfile: {
              select: {
                attendanceSettingsJson: true,
                department: { select: { id: true, name: true } },
                branch: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
              },
            },
          },
        },
        hrReviewedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getAttendanceStats(query: {
    date?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const totalEmployees = await this.prisma.user.count({
      where: { isActive: true, deletedAt: null },
    });

    let targetDate = new Date();
    if (query.date) {
      targetDate = new Date(query.date);
    }
    const startOfDay = new Date(targetDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setUTCHours(23, 59, 59, 999);

    const todayRecords = await this.prisma.attendance.findMany({
      where: {
        date: { gte: startOfDay, lte: endOfDay },
      },
    });

    const present = todayRecords.filter(
      (r) => r.status === 'PRESENT' || r.status === 'LATE',
    ).length;
    const absent = todayRecords.filter((r) => r.status === 'ABSENT').length;
    const late = todayRecords.filter((r) => r.status === 'LATE').length;
    const onLeave = todayRecords.filter(
      (r) => r.status === 'ON_LEAVE' || r.status === 'HALF_DAY',
    ).length;
    const mismatches = todayRecords.filter(
      (r) =>
        r.notes &&
        (r.notes.includes('PROXY ALERT') || r.notes.includes('Mismatch')),
    ).length;

    return {
      totalEmployees,
      present,
      absent,
      late,
      onLeave,
      mismatches,
    };
  }

  /**
   * The office-geofence line for a punch: the employee's branch, or the only branch with coordinates.
   * Null when no office has coordinates yet (geofence not set up) or the employee works remotely.
   */
  private async geofenceLine(
    employeeId: string,
    at: { latitude?: number; longitude?: number; accuracyMeters?: number },
  ): Promise<string | null> {
    const profile = await this.prisma.employeeProfile
      .findUnique({
        where: { userId: employeeId },
        select: {
          attendanceSettingsJson: true,
          branch: {
            select: {
              name: true,
              latitude: true,
              longitude: true,
              radiusMeters: true,
            },
          },
        },
      })
      .catch(() => null);
    let mode = '';
    try {
      mode = String(
        JSON.parse(profile?.attendanceSettingsJson || '{}')?.mode || '',
      );
    } catch {
      /* old free text */
    }
    if (/remote|wfh|work from home/i.test(mode)) return null; // remote staff are not tied to an office
    let office = profile?.branch?.latitude != null ? profile.branch : null;
    if (!office) {
      const withCoords = await this.prisma.branch.findMany({
        where: {
          deletedAt: null,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          name: true,
          latitude: true,
          longitude: true,
          radiusMeters: true,
        },
        take: 2,
      });
      office = withCoords.length === 1 ? withCoords[0] : null;
    }
    return geofenceNote(office, at);
  }

  async logAttendance(dto: LogAttendanceDto, selfPunch = false) {
    // A self check-in's face-check line comes from the server's biometric audit log, never the browser.
    if (selfPunch && (dto.clockIn || dto.clockOut)) {
      const check = await this.prisma.biometricAuditLog
        .findFirst({
          where: {
            employeeId: dto.employeeId,
            purpose: { in: ['ATTENDANCE', 'ENROLLMENT'] },
            action: {
              in: ['VERIFICATION', 'ENROLLMENT', 'RE_ENROLLMENT'] as any,
            },
            createdAt: { gte: new Date(Date.now() - FACE_CHECK_WINDOW_MS) },
          },
          orderBy: { createdAt: 'desc' },
          select: {
            action: true,
            verificationStatus: true,
            matchScore: true,
            createdAt: true,
          },
        })
        .catch(() => null);
      const where = await this.geofenceLine(dto.employeeId, dto);
      const profile = await this.prisma.employeeProfile.findUnique({
        where: { userId: dto.employeeId },
        select: { attendanceSettingsJson: true },
      });
      const shift = shiftFrom(profile?.attendanceSettingsJson);
      let shiftLine = '';
      if (dto.clockIn) {
        const verdict = clockInVerdict(
          parseOptionalDate(dto.clockIn) || new Date(),
          shift,
        );
        if (!dto.status || dto.status === 'PRESENT' || dto.status === 'LATE')
          dto = { ...dto, status: verdict.status };
        shiftLine = verdict.note;
      } else if (dto.clockOut) {
        shiftLine = clockOutNote(
          parseOptionalDate(dto.clockOut) || new Date(),
          shift,
        );
      }
      dto = {
        ...dto,
        notes: joinNotes(selfPunchNote(check, dto.notes), where, shiftLine),
      };
    }
    const dateObj = parseCreateDate(dto.date) || new Date();
    const y = dateObj.getUTCFullYear();
    const m = dateObj.getUTCMonth();
    const d = dateObj.getUTCDate();
    const normalizedDate = new Date(Date.UTC(y, m, d, 0, 0, 0));

    // A self clock-out keeps the morning's status (LATE stays LATE) and adds to its notes.
    const existing =
      selfPunch && dto.clockOut && !dto.clockIn
        ? await this.prisma.attendance.findUnique({
            where: {
              employeeId_date: {
                employeeId: dto.employeeId,
                date: normalizedDate,
              },
            },
            select: { status: true, notes: true },
          })
        : null;
    if (existing)
      dto = {
        ...dto,
        status: existing.status,
        notes: joinNotes(existing.notes, dto.notes),
      };

    return this.prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: dto.employeeId,
          date: normalizedDate,
        },
      },
      create: {
        employeeId: dto.employeeId,
        date: normalizedDate,
        clockIn: dto.clockIn ? parseOptionalDate(dto.clockIn) : null,
        clockOut: dto.clockOut ? parseOptionalDate(dto.clockOut) : null,
        status: dto.status,
        notes: dto.notes,
      },
      update: {
        ...(dto.clockIn ? { clockIn: parseOptionalDate(dto.clockIn) } : {}),
        ...(dto.clockOut ? { clockOut: parseOptionalDate(dto.clockOut) } : {}),
        status: dto.status,
        notes: dto.notes,
      },
    });
  }

  async deleteAttendance(id: string) {
    return this.prisma.attendance.delete({ where: { id } });
  }

  /**
   * HR decision on a biometric-flagged (proxy/mismatch) punch. DENIED rejects the claimed
   * presence outright (status -> ABSENT); APPROVED clears the flag but leaves status as-is
   * (the punch was already logged PRESENT by the employee's clock-in/out action).
   */
  async reviewAttendance(
    id: string,
    decision: 'APPROVED' | 'DENIED',
    reviewedById: string,
    note?: string,
  ) {
    const record = await this.prisma.attendance.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('Attendance record not found');
    }

    return this.prisma.attendance.update({
      where: { id },
      data: {
        hrReviewStatus: decision,
        hrReviewedById: reviewedById,
        hrReviewedAt: new Date(),
        hrReviewNote: note,
        ...(decision === 'DENIED' ? { status: 'ABSENT' } : {}),
      },
    });
  }

  // ─── V4 ENTERPRISE LEAVE ENGINE ─────────────────────────────────────────────

  private async getOrCreateCurrentLeaveCycle(organizationId: string) {
    const currentYear = new Date().getFullYear();
    const cycle = await this.prisma.leaveCycle.findFirst({
      where: { organizationId, isCurrent: true },
    });
    if (cycle) return cycle;

    const name = `Calendar Year ${currentYear}`;
    return this.prisma.leaveCycle.create({
      data: {
        organizationId,
        name,
        startDate: `${currentYear}-01-01`,
        endDate: `${currentYear}-12-31`,
        isCurrent: true,
      },
    });
  }

  async checkOverlappingLeave(
    employeeId: string,
    startDateStr: string,
    endDateStr: string,
    excludeRequestId?: string,
  ) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    const existing = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
      },
    });

    for (const req of existing) {
      const reqStart = new Date(req.startDate);
      const reqEnd = new Date(req.endDate);
      if (start <= reqEnd && end >= reqStart) {
        throw new BadRequestException(
          `Leave request dates (${startDateStr} to ${endDateStr}) overlap with an existing ${req.status} leave (${req.startDate.toISOString().split('T')[0]} to ${req.endDate.toISOString().split('T')[0]})`,
        );
      }
    }
  }

  async calculateShiftAwareDuration(
    employeeId: string,
    startDateStr: string,
    endDateStr: string,
    durationType: LeaveDurationType = LeaveDurationType.FULL_DAY,
    hoursRequested?: number,
  ): Promise<number> {
    if (durationType === LeaveDurationType.HOURLY && hoursRequested) {
      const profile = await this.prisma.employeeProfile.findUnique({
        where: { userId: employeeId },
      });
      let shiftHours = 8.0;
      if (profile?.attendanceSettingsJson) {
        try {
          const settings = JSON.parse(profile.attendanceSettingsJson);
          if (settings.shiftStartTime && settings.shiftEndTime) {
            const [sh, sm] = settings.shiftStartTime.split(':').map(Number);
            const [eh, em] = settings.shiftEndTime.split(':').map(Number);
            const diffMins = eh * 60 + em - (sh * 60 + sm);
            if (diffMins > 0) shiftHours = Math.max(1, (diffMins - 60) / 60); // Subtract lunch hour
          }
        } catch (_) {}
      }
      return Number((hoursRequested / shiftHours).toFixed(2));
    }

    if (durationType === LeaveDurationType.HALF_DAY) {
      return 0.5;
    }

    const profile = await this.prisma.employeeProfile.findUnique({
      where: { userId: employeeId },
      include: { user: { select: { organizationId: true } } },
    });
    const orgId =
      profile?.user?.organizationId ||
      (await this.prisma.organization.findFirst())?.id;

    const holidays = orgId
      ? await this.prisma.companyHoliday.findMany({
          where: {
            organizationId: orgId,
            date: { gte: startDateStr, lte: endDateStr },
          },
        })
      : [];
    const holidayDates = new Set(holidays.map((h) => h.date));

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    let workingDays = 0;

    while (start <= end) {
      const dateStr = start.toISOString().split('T')[0];
      const dayOfWeek = start.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
      const isHoliday = holidayDates.has(dateStr);

      if (!isWeekend && !isHoliday) {
        workingDays += 1;
      }

      start.setDate(start.getDate() + 1);
    }

    return workingDays > 0 ? workingDays : 1.0;
  }

  async listLeaves(query: { employeeId?: string; status?: LeaveStatus }) {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;

    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        policy: true,
        approvalSteps: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLeave(dto: CreateLeaveRequestDto) {
    const startStr = dto.startDate;
    const endStr = dto.endDate;
    if (new Date(endStr) < new Date(startStr)) {
      throw new BadRequestException('End date cannot be before start date');
    }

    await this.checkOverlappingLeave(dto.employeeId, startStr, endStr);

    const computedDays = await this.calculateShiftAwareDuration(
      dto.employeeId,
      startStr,
      endStr,
      dto.durationType || LeaveDurationType.FULL_DAY,
      dto.hoursRequested,
    );

    const empPolicyAssignment = await this.prisma.employeeLeavePolicy.findFirst(
      {
        where: {
          employeeId: dto.employeeId,
          policy: { isActive: true },
        },
        include: {
          policy: {
            include: { rules: true },
          },
        },
      },
    );

    const policyRule = empPolicyAssignment?.policy?.rules.find(
      (r) => r.leaveType === dto.leaveType,
    );
    let ruleSnapshotJson: string | undefined = undefined;

    if (policyRule) {
      ruleSnapshotJson = JSON.stringify({
        allowedDays: Number(policyRule.allowedDays),
        accrualType: policyRule.accrualType,
        sandwichPolicy: policyRule.sandwichPolicy,
        carryForward: policyRule.carryForward,
        policyVersion: empPolicyAssignment?.policy.version,
      });
    }

    const employee = await this.prisma.user.findUniqueOrThrow({
      where: { id: dto.employeeId },
    });
    const orgId =
      employee.organizationId ||
      (await this.prisma.organization.findFirst())?.id;

    if (orgId) {
      const cycle = await this.getOrCreateCurrentLeaveCycle(orgId);
      await this.prisma.leaveBalance.upsert({
        where: {
          userId_leaveType_cycleId: {
            userId: dto.employeeId,
            leaveType: dto.leaveType,
            cycleId: cycle.id,
          },
        },
        create: {
          userId: dto.employeeId,
          leaveType: dto.leaveType,
          cycleId: cycle.id,
          allocated: 12.0,
          accrued: 12.0,
          used: 0.0,
          pending: computedDays,
          available: 12.0 - computedDays,
        },
        update: {
          pending: { increment: computedDays },
          available: { decrement: computedDays },
        },
      });
    }

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: dto.employeeId,
        leaveType: dto.leaveType,
        startDate: new Date(startStr),
        endDate: new Date(endStr),
        durationType: dto.durationType || LeaveDurationType.FULL_DAY,
        halfDaySlot: dto.halfDaySlot,
        hoursRequested: dto.hoursRequested,
        durationDays: computedDays,
        reason: dto.reason,
        status: LeaveStatus.PENDING,
        policyId: empPolicyAssignment?.policyId,
        policyRuleId: policyRule?.id,
        ruleSnapshotJson,
      },
    });
  }

  async updateLeaveStatus(
    id: string,
    dto: UpdateLeaveStatusDto,
    managerId: string,
  ) {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            organizationId: true,
          },
        },
      },
    });
    if (!request) throw new NotFoundException(`Leave request ${id} not found`);

    if (dto.status === 'APPROVED' && request.status !== LeaveStatus.PENDING) {
      throw new BadRequestException(
        `Leave request has already been ${request.status.toLowerCase()}`,
      );
    }

    const emp = request.employee;
    const duration = Number(request.durationDays || 1.0);
    const orgId =
      emp.organizationId || (await this.prisma.organization.findFirst())?.id;

    if (dto.status === 'APPROVED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.APPROVED,
            remarks: dto.remarks,
            approvedById: managerId,
          },
        });

        if (orgId) {
          const cycle = await this.getOrCreateCurrentLeaveCycle(orgId);
          await tx.leaveBalance.upsert({
            where: {
              userId_leaveType_cycleId: {
                userId: request.employeeId,
                leaveType: request.leaveType,
                cycleId: cycle.id,
              },
            },
            create: {
              userId: request.employeeId,
              leaveType: request.leaveType,
              cycleId: cycle.id,
              allocated: 12.0,
              accrued: 12.0,
              used: duration,
              pending: 0.0,
              available: 12.0 - duration,
            },
            update: {
              pending: { decrement: duration },
              used: { increment: duration },
            },
          });

          await tx.leaveLedger.create({
            data: {
              userId: request.employeeId,
              leaveType: request.leaveType,
              transactionType: LeaveTransactionType.LEAVE_DEBIT,
              quantity: -duration,
              referenceType: ReferenceType.LEAVE_REQUEST,
              referenceId: request.id,
              createdById: managerId,
              remarks: `Approved leave from ${request.startDate.toISOString().split('T')[0]} to ${request.endDate.toISOString().split('T')[0]}`,
            },
          });
        }

        const curr = new Date(request.startDate);
        const last = new Date(request.endDate);
        const attStatus =
          request.durationType === LeaveDurationType.HALF_DAY
            ? 'HALF_DAY'
            : 'ON_LEAVE';

        while (curr <= last) {
          const y = curr.getUTCFullYear();
          const m = curr.getUTCMonth();
          const d = curr.getUTCDate();
          const normDate = new Date(Date.UTC(y, m, d, 0, 0, 0));

          await tx.attendance.upsert({
            where: {
              employeeId_date: {
                employeeId: request.employeeId,
                date: normDate,
              },
            },
            create: {
              employeeId: request.employeeId,
              date: normDate,
              status: attStatus as any,
              notes: `Approved Leave (${request.leaveType})`,
            },
            update: {
              status: attStatus as any,
              notes: `Approved Leave (${request.leaveType})`,
            },
          });

          curr.setDate(curr.getDate() + 1);
        }
      });
    } else if (dto.status === 'REJECTED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.REJECTED,
            remarks: dto.remarks,
            approvedById: managerId,
          },
        });

        if (orgId) {
          const cycle = await this.getOrCreateCurrentLeaveCycle(orgId);
          await tx.leaveBalance.updateMany({
            where: {
              userId: request.employeeId,
              leaveType: request.leaveType,
              cycleId: cycle.id,
            },
            data: {
              pending: { decrement: duration },
              available: { increment: duration },
            },
          });
        }
      });
    } else if (dto.status === 'CANCELLED') {
      await this.prisma.$transaction(async (tx) => {
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status: LeaveStatus.CANCELLED,
            remarks: dto.remarks || 'Cancelled by employee/HR',
          },
        });

        if (orgId && request.status === LeaveStatus.APPROVED) {
          const cycle = await this.getOrCreateCurrentLeaveCycle(orgId);
          await tx.leaveBalance.updateMany({
            where: {
              userId: request.employeeId,
              leaveType: request.leaveType,
              cycleId: cycle.id,
            },
            data: {
              used: { decrement: duration },
              available: { increment: duration },
            },
          });

          await tx.leaveLedger.create({
            data: {
              userId: request.employeeId,
              leaveType: request.leaveType,
              transactionType: LeaveTransactionType.LEAVE_REVERSAL,
              quantity: duration,
              referenceType: ReferenceType.LEAVE_REQUEST,
              referenceId: request.id,
              createdById: managerId,
              remarks: `Reversal for cancelled leave ${request.id}`,
            },
          });

          const curr = new Date(request.startDate);
          const last = new Date(request.endDate);
          while (curr <= last) {
            const y = curr.getUTCFullYear();
            const m = curr.getUTCMonth();
            const d = curr.getUTCDate();
            const normDate = new Date(Date.UTC(y, m, d, 0, 0, 0));

            const att = await tx.attendance.findUnique({
              where: {
                employeeId_date: {
                  employeeId: request.employeeId,
                  date: normDate,
                },
              },
            });
            if (att) {
              if (att.clockIn) {
                await tx.attendance.update({
                  where: { id: att.id },
                  data: {
                    status: 'PRESENT',
                    notes:
                      'Leave cancelled — recalculated from biometric punch',
                  },
                });
              } else {
                await tx.attendance.update({
                  where: { id: att.id },
                  data: {
                    status: 'ABSENT',
                    notes: 'Leave cancelled — no punch recorded',
                  },
                });
              }
            }

            curr.setDate(curr.getDate() + 1);
          }
        }
      });
    }

    try {
      const isApproved = dto.status === 'APPROVED';
      const fmt = (d: Date | null) =>
        d
          ? new Date(d).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : '—';
      await this.notificationsService.queueEmail(
        emp.email,
        isApproved ? 'leave_approved' : 'leave_rejected',
        {
          employeeName: `${emp.firstName} ${emp.lastName}`,
          leaveType: request.leaveType.replace(/_/g, ' '),
          startDate: fmt(request.startDate),
          endDate: fmt(request.endDate),
          remarks: dto.remarks || '',
        },
        isApproved
          ? `✅ Your Leave Request Has Been Approved`
          : `❌ Your Leave Request Has Been Updated`,
      );
    } catch (err) {
      console.error('[HR] Failed to send leave status email:', err?.message);
    }

    return this.prisma.leaveRequest.findUnique({ where: { id } });
  }

  // ─── Leave Balance & Auditable Ledger APIs ──────────────────────────────────

  async getLeaveBalances(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const orgId =
      user.organizationId || (await this.prisma.organization.findFirst())?.id;
    if (!orgId) return [];

    const cycle = await this.getOrCreateCurrentLeaveCycle(orgId);

    const balances = await this.prisma.leaveBalance.findMany({
      where: { userId, cycleId: cycle.id },
    });

    if (balances.length === 0) {
      const defaultTypes: LeaveType[] = [
        LeaveType.CASUAL,
        LeaveType.SICK,
        LeaveType.EARNED,
      ];
      for (const lt of defaultTypes) {
        await this.prisma.leaveBalance.create({
          data: {
            userId,
            leaveType: lt,
            cycleId: cycle.id,
            allocated:
              lt === LeaveType.CASUAL
                ? 12.0
                : lt === LeaveType.SICK
                  ? 10.0
                  : 15.0,
            accrued:
              lt === LeaveType.CASUAL
                ? 12.0
                : lt === LeaveType.SICK
                  ? 10.0
                  : 15.0,
            used: 0.0,
            pending: 0.0,
            available:
              lt === LeaveType.CASUAL
                ? 12.0
                : lt === LeaveType.SICK
                  ? 10.0
                  : 15.0,
          },
        });
      }
      return this.prisma.leaveBalance.findMany({
        where: { userId, cycleId: cycle.id },
      });
    }

    return balances;
  }

  async getLeaveLedger(userId: string) {
    return this.prisma.leaveLedger.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createManualLedgerAdjustment(dto: {
    userId: string;
    leaveType: LeaveType;
    quantity: number;
    remarks: string;
    adminUserId: string;
  }) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: dto.userId },
    });
    const orgId =
      user.organizationId || (await this.prisma.organization.findFirst())?.id;
    if (!orgId)
      throw new BadRequestException('Organization not found for user');

    const cycle = await this.getOrCreateCurrentLeaveCycle(orgId);

    return this.prisma.$transaction(async (tx) => {
      const ledger = await tx.leaveLedger.create({
        data: {
          userId: dto.userId,
          leaveType: dto.leaveType,
          transactionType: LeaveTransactionType.ADJUSTMENT,
          quantity: dto.quantity,
          referenceType: ReferenceType.ADMIN_ADJUSTMENT,
          createdById: dto.adminUserId,
          remarks: dto.remarks,
        },
      });

      await tx.leaveBalance.upsert({
        where: {
          userId_leaveType_cycleId: {
            userId: dto.userId,
            leaveType: dto.leaveType,
            cycleId: cycle.id,
          },
        },
        create: {
          userId: dto.userId,
          leaveType: dto.leaveType,
          cycleId: cycle.id,
          allocated: 12.0,
          accrued: 12.0 + dto.quantity,
          used: 0.0,
          pending: 0.0,
          available: 12.0 + dto.quantity,
        },
        update: {
          accrued: { increment: dto.quantity },
          available: { increment: dto.quantity },
        },
      });

      return ledger;
    });
  }

  // ─── Company Holidays & Policies Management ─────────────────────────────────

  async listCompanyHolidays(year?: number) {
    const org = await this.prisma.organization.findFirst();
    if (!org) return [];

    return this.prisma.companyHoliday.findMany({
      where: {
        organizationId: org.id,
        ...(year ? { year } : {}),
      },
      include: { branch: true },
      orderBy: { date: 'asc' },
    });
  }

  async createCompanyHoliday(dto: {
    date: string;
    name: string;
    type?: HolidayType;
    isOptional?: boolean;
    branchId?: string;
  }) {
    const org = await this.prisma.organization.findFirst();
    if (!org) throw new BadRequestException('No organization setup found');

    const year = new Date(dto.date).getFullYear();

    return this.prisma.companyHoliday.create({
      data: {
        organizationId: org.id,
        branchId: dto.branchId || null,
        date: dto.date,
        name: dto.name,
        type: dto.type || HolidayType.COMPANY,
        isOptional: dto.isOptional || false,
        year,
      },
    });
  }

  async deleteCompanyHoliday(id: string) {
    return this.prisma.companyHoliday.delete({ where: { id } });
  }

  // ─── Leave Policies & Rules Matrix ─────────────────────────────────────────

  async listLeavePolicies() {
    const org = await this.prisma.organization.findFirst();
    if (!org) return [];

    return this.prisma.leavePolicy.findMany({
      where: { organizationId: org.id },
      include: {
        rules: true,
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createLeavePolicy(dto: {
    name: string;
    description?: string;
    rules: any[];
  }) {
    const org = await this.prisma.organization.findFirst();
    if (!org) throw new BadRequestException('No organization setup found');

    const existingCount = await this.prisma.leavePolicy.count({
      where: { organizationId: org.id, name: dto.name },
    });

    const version = existingCount + 1;

    return this.prisma.leavePolicy.create({
      data: {
        organizationId: org.id,
        name: dto.name,
        version,
        description: dto.description,
        rules: {
          create: (dto.rules || []).map((r: any) => ({
            leaveType: r.leaveType,
            allowedDays: r.allowedDays || 12.0,
            accrualType: r.accrualType || 'ANNUAL',
            monthlyAccrualRate: r.monthlyAccrualRate || 0.0,
            probationAllowed: r.probationAllowed !== false,
            carryForward: r.carryForward || false,
            maxCarryForwardDays: r.maxCarryForwardDays || 0.0,
            sandwichPolicy: r.sandwichPolicy || 'NONE',
            halfDayAllowed: r.halfDayAllowed !== false,
            hourlyAllowed: r.hourlyAllowed || false,
          })),
        },
      },
      include: { rules: true },
    });
  }

  async assignEmployeeLeavePolicy(dto: {
    employeeId: string;
    policyId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    adminUserId?: string;
  }) {
    const start = dto.effectiveFrom;

    const existingOverlaps = await this.prisma.employeeLeavePolicy.findMany({
      where: {
        employeeId: dto.employeeId,
        effectiveFrom: { lte: dto.effectiveTo || '2099-12-31' },
      },
    });

    for (const p of existingOverlaps) {
      const pTo = p.effectiveTo || '2099-12-31';
      if (start <= pTo) {
        throw new BadRequestException(
          `Employee already has an active policy assignment overlapping with date ${start}`,
        );
      }
    }

    return this.prisma.employeeLeavePolicy.create({
      data: {
        employeeId: dto.employeeId,
        policyId: dto.policyId,
        effectiveFrom: dto.effectiveFrom,
        effectiveTo: dto.effectiveTo || null,
        assignedById: dto.adminUserId || null,
      },
      include: { policy: { include: { rules: true } } },
    });
  }

  // ─── Approval Delegation ────────────────────────────────────────────────────

  async listApprovalDelegations(delegatorId?: string) {
    return this.prisma.approvalDelegation.findMany({
      where: { ...(delegatorId ? { delegatorId } : {}), isActive: true },
      include: {
        delegator: { select: { id: true, firstName: true, lastName: true } },
        delegate: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }

  async createApprovalDelegation(dto: {
    delegatorId: string;
    delegateId: string;
    fromDate: string;
    toDate: string;
  }) {
    return this.prisma.approvalDelegation.create({
      data: {
        delegatorId: dto.delegatorId,
        delegateId: dto.delegateId,
        fromDate: dto.fromDate,
        toDate: dto.toDate,
        isActive: true,
      },
    });
  }

  // ─── Employee Self-Service (ESS) ─────────────────────────────────────────

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        role: true,
        employmentType: true,
        createdAt: true,
        employeeProfile: {
          include: {
            department: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User profile not found');
    return user;
  }

  async getMyAssets(userId: string) {
    return this.prisma.officeAsset.findMany({
      where: {
        assignments: {
          some: {
            employeeId: userId,
            returnDate: null,
          },
        },
      },
      include: {
        assignments: true,
      },
    });
  }
}
