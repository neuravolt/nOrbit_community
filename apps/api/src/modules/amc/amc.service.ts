import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AmcRepository } from './amc.repository';
import {
  CreateAmcContractDto,
  UpdateAmcContractDto,
  RenewAmcContractDto,
  LogAmcHoursDto,
  ListAmcContractsQuery,
  AmcContractDto,
} from './dto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AmcService {
  constructor(
    private readonly amcRepository: AmcRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getContract(id: string): Promise<AmcContractDto> {
    const contract = await this.amcRepository.findById(id);

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    return this.enrichContractData(contract);
  }

  async listContracts(query: ListAmcContractsQuery, user?: any) {
    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.amcRepository.findAll(query, orgId);

    return {
      ...result,
      contracts: result.contracts.map((contract) =>
        this.enrichContractListData(contract),
      ),
    };
  }

  async createContract(createAmcDto: CreateAmcContractDto, user?: any) {
    // Validate client exists
    const client = await this.prisma.client.findUnique({
      where: { id: createAmcDto.clientId },
    });

    if (!client) {
      throw new BadRequestException(
        `Client with ID ${createAmcDto.clientId} not found`,
      );
    }

    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;

    // Convert dates from strings to Date objects
    const startDate = new Date(createAmcDto.startDate);
    const endDate = new Date(createAmcDto.endDate);

    // Validate endDate > startDate
    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate totalHours is positive
    if (Number(createAmcDto.totalHours) <= 0) {
      throw new BadRequestException('Total hours must be greater than 0');
    }

    // Generate contract number if not provided or set to Auto-Generated
    let contractNumber = createAmcDto.contractNumber;
    if (
      !contractNumber ||
      contractNumber.trim() === '' ||
      contractNumber === 'Auto-Generated'
    ) {
      const cleanName = client.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
      const clientPart = (cleanName.slice(0, 2) || 'XX').padEnd(2, 'X');

      const now = new Date();
      const datePart = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;

      let attempts = 0;
      let uniqueNumber = '';
      while (attempts < 10) {
        const randomPart = String(Math.floor(Math.random() * 90) + 10); // 2 digit random number (10-99)
        uniqueNumber = `AMC${clientPart}-${datePart}-${randomPart}`;
        const conflict =
          await this.amcRepository.findByContractNumber(uniqueNumber);
        if (!conflict) break;
        attempts++;
      }
      contractNumber = uniqueNumber;
    } else {
      // Validate uniqueness for manual/existing contract number
      const existingContract =
        await this.amcRepository.findByContractNumber(contractNumber);
      if (existingContract) {
        throw new BadRequestException(
          `Contract number ${contractNumber} already exists`,
        );
      }
    }

    const contract = await this.amcRepository.create({
      ...createAmcDto,
      organizationId: orgId,
      contractNumber,
      startDate,
      endDate,
      totalHours: Math.round(Number(createAmcDto.totalHours)),
      hourlyRate: Number(createAmcDto.hourlyRate),
      discount: Number(createAmcDto.discount ?? 0),
    } as any);

    return this.enrichContractData(contract);
  }

  async updateContract(
    id: string,
    updateAmcDto: UpdateAmcContractDto,
    user?: any,
  ) {
    const contract = await this.amcRepository.findById(id);

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    const invoiceCount = await this.prisma.invoice.count({
      where: { amcContractId: id },
    });
    if (invoiceCount > 0) {
      const userRole = user?.role || '';
      if (userRole.toUpperCase() !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'Only Super Admins can edit AMC contracts that have generated invoices',
        );
      }
    }

    // Validate endDate > startDate if updating dates
    if (updateAmcDto.startDate && updateAmcDto.endDate) {
      if (updateAmcDto.endDate <= updateAmcDto.startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    } else if (
      updateAmcDto.endDate &&
      updateAmcDto.endDate <= contract.startDate
    ) {
      throw new BadRequestException('End date must be after start date');
    } else if (
      updateAmcDto.startDate &&
      updateAmcDto.startDate >= contract.endDate
    ) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Validate totalHours is positive if updating
    if (updateAmcDto.totalHours !== undefined && updateAmcDto.totalHours <= 0) {
      throw new BadRequestException('Total hours must be greater than 0');
    }

    // Validate status is valid
    if (
      updateAmcDto.status &&
      !['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(updateAmcDto.status)
    ) {
      throw new BadRequestException(
        'Invalid status. Must be ACTIVE, EXPIRED, or CANCELLED',
      );
    }

    if (updateAmcDto.discount !== undefined) {
      updateAmcDto.discount = Number(updateAmcDto.discount);
    }

    const updated = await this.amcRepository.update(id, updateAmcDto);

    return this.enrichContractData(updated);
  }

  async renewContract(id: string, renewAmcDto: RenewAmcContractDto) {
    const contract = await this.amcRepository.findById(id);

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    if (contract.status === 'CANCELLED') {
      throw new BadRequestException('Cannot renew a cancelled contract');
    }

    // Validate newEndDate > current endDate (or startDate if resetHours)
    const compareDate = renewAmcDto.resetHours
      ? contract.startDate
      : contract.endDate;

    if (renewAmcDto.newEndDate <= compareDate) {
      throw new BadRequestException(
        'New end date must be after current end date',
      );
    }

    // Validate newTotalHours if provided
    if (
      renewAmcDto.newTotalHours !== undefined &&
      renewAmcDto.newTotalHours <= 0
    ) {
      throw new BadRequestException('New total hours must be greater than 0');
    }

    const renewed = await this.amcRepository.renew(
      id,
      renewAmcDto.newEndDate,
      renewAmcDto.resetHours || false,
      renewAmcDto.newTotalHours,
    );

    return this.enrichContractData(renewed);
  }

  async logHours(id: string, userId: string, logAmcHoursDto: LogAmcHoursDto) {
    const contract = await this.amcRepository.findById(id);

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    // Validate contract is active
    if (contract.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot log hours against an ${contract.status} contract`,
      );
    }

    // Validate contract is not expired
    if (new Date() > contract.endDate) {
      throw new BadRequestException(
        'Cannot log hours against an expired contract',
      );
    }

    // Validate hours is positive
    if (logAmcHoursDto.hours <= 0) {
      throw new BadRequestException('Hours must be greater than 0');
    }

    // Check if logging would exceed totalHours
    const totalLoggedHours = await this.amcRepository.getTotalLoggedHours(id);

    if (totalLoggedHours + logAmcHoursDto.hours > contract.totalHours) {
      throw new BadRequestException(
        `Cannot log ${logAmcHoursDto.hours} hours. Total would exceed ${contract.totalHours} hours limit. ` +
          `Already logged: ${totalLoggedHours} hours, Remaining: ${contract.totalHours - totalLoggedHours} hours`,
      );
    }

    // Validate linked ticket exists if provided
    if (logAmcHoursDto.linkedTicketId) {
      const ticket = await this.prisma.ticket.findUnique({
        where: { id: logAmcHoursDto.linkedTicketId },
      });

      if (!ticket) {
        throw new BadRequestException(
          `Ticket with ID ${logAmcHoursDto.linkedTicketId} not found`,
        );
      }
    }

    // Validate linked task exists if provided
    if (logAmcHoursDto.linkedTaskId) {
      const task = await this.prisma.task.findUnique({
        where: { id: logAmcHoursDto.linkedTaskId },
      });

      if (!task) {
        throw new BadRequestException(
          `Task with ID ${logAmcHoursDto.linkedTaskId} not found`,
        );
      }
    }

    // Log the hours
    const hourLog = await this.amcRepository.logHours(
      id,
      userId,
      logAmcHoursDto,
    );

    // Update contract usedHours
    await this.amcRepository.updateUsedHours(id, logAmcHoursDto.hours);

    return hourLog;
  }

  async getHourLogs(id: string) {
    const contract = await this.amcRepository.findById(id);

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    return this.amcRepository.findHourLogs(id);
  }

  async getRenewalsDue(daysThreshold: number = 30, user?: any) {
    const orgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const contracts = await this.amcRepository.findRenewalsDue(
      daysThreshold,
      orgId,
    );

    return contracts.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      clientId: contract.clientId,
      clientName: contract.client.name,
      endDate: contract.endDate,
      daysUntilExpiry: Math.ceil(
        (contract.endDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      ),
      status: contract.status,
    }));
  }

  async deleteContract(id: string) {
    const contract = await this.amcRepository.findById(id);

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    await this.amcRepository.softDelete(id);

    return { id, deleted: true };
  }

  async restoreContract(id: string) {
    const contract = await this.prisma.amcContract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException(`AMC contract with ID ${id} not found`);
    }

    if (!contract.deletedAt) {
      throw new BadRequestException(
        'Contract is not deleted and cannot be restored',
      );
    }

    const restored = await this.amcRepository.restore(id);

    return this.enrichContractData(restored);
  }

  // Helper method to enrich contract data with calculated fields
  private enrichContractData(contract: any): AmcContractDto {
    const now = Date.now();
    const endDateTime = contract.endDate.getTime();
    const daysUntilExpiry = Math.ceil(
      (endDateTime - now) / (24 * 60 * 60 * 1000),
    );
    const isExpired = now > endDateTime;
    const isRenewalDue =
      !isExpired && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    const usagePercentage =
      contract.totalHours > 0
        ? Math.round((contract.usedHours / contract.totalHours) * 100)
        : 0;
    const hoursNearLimit = usagePercentage >= 80;
    const remainingHours = Math.max(
      0,
      contract.totalHours - contract.usedHours,
    );
    const totalValue = contract.totalHours * contract.hourlyRate;
    const usedValue = contract.usedHours * contract.hourlyRate;

    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      clientId: contract.clientId,
      client: contract.client,
      startDate: contract.startDate,
      endDate: contract.endDate,
      totalHours: contract.totalHours,
      usedHours: contract.usedHours,
      hourlyRate: contract.hourlyRate,
      terms: contract.terms,
      status: contract.status,
      autoRenew: contract.autoRenew,
      discount: contract.discount,
      billingCycle: contract.billingCycle,
      monthlyValue: contract.monthlyValue ? Number(contract.monthlyValue) : 0,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
      // Calculated fields
      remainingHours,
      usagePercentage,
      daysUntilExpiry,
      isExpired,
      isRenewalDue,
      hoursNearLimit,
      totalValue,
      usedValue,
      hourLogCount: contract.hourLogs?.length || 0,
      invoiceCount: contract._count?.invoices || 0,
      tasks: contract.tasks || [],
      tickets: contract.tickets || [],
      assets: contract.assets || [],
    };
  }

  private enrichContractListData(contract: any) {
    const now = Date.now();
    const endDateTime = contract.endDate.getTime();
    const daysUntilExpiry = Math.ceil(
      (endDateTime - now) / (24 * 60 * 60 * 1000),
    );
    const isExpired = now > endDateTime;
    const isRenewalDue =
      !isExpired && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    const usagePercentage =
      contract.totalHours > 0
        ? Math.round((contract.usedHours / contract.totalHours) * 100)
        : 0;
    const hoursNearLimit = usagePercentage >= 80;

    return {
      id: contract.id,
      contractNumber: contract.contractNumber,
      clientId: contract.clientId,
      clientName: contract.client.name,
      startDate: contract.startDate,
      endDate: contract.endDate,
      totalHours: contract.totalHours,
      usedHours: contract.usedHours,
      hourlyRate: contract.hourlyRate,
      status: contract.status,
      discount: contract.discount,
      billingCycle: contract.billingCycle,
      monthlyValue: contract.monthlyValue ? Number(contract.monthlyValue) : 0,
      daysUntilExpiry,
      isExpired,
      isRenewalDue,
      usagePercentage,
      hoursNearLimit,
      hourLogCount: contract._count?.hourLogs || 0,
      invoiceCount: contract._count?.invoices || 0,
      assets: contract.assets || [],
    };
  }
}
