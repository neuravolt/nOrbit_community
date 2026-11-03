import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { AssetsRepository } from './assets.repository';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateAssetDto,
  UpdateAssetDto,
  ListAssetsQuery,
  AssetDto,
  ListAssetsResponseDto,
  UpcomingRenewalDto,
  ResetPasswordDto,
} from './dto';
import { encrypt, decrypt, getEncryptionKey } from '@neuravolt/shared-utils';
import { PlansEnforcementService } from '../plans/plans-enforcement.service';

@Injectable()
export class AssetsService {
  private readonly VALID_TYPES = [
    'DOMAIN',
    'HOSTING',
    'VPS',
    'WEBSITE',
    'ADMIN_PANEL',
    'MOBILE_APP',
    'API_SERVICE',
    'SSL_CERTIFICATE',
  ];
  private readonly RENEWAL_THRESHOLD_DAYS = 30;

  constructor(
    private readonly assetsRepository: AssetsRepository,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly plansEnforcementService?: PlansEnforcementService,
  ) {}

  private getEncryptionKey(): string {
    return getEncryptionKey();
  }

  private encryptMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') return {};
    try {
      const key = this.getEncryptionKey();
      const result = { ...metadata };
      if (
        result.rootPassword &&
        typeof result.rootPassword === 'string' &&
        !result.rootPassword.includes(':')
      ) {
        result.rootPassword = encrypt(result.rootPassword, key);
      }
      if (
        result.adminPassword &&
        typeof result.adminPassword === 'string' &&
        !result.adminPassword.includes(':')
      ) {
        result.adminPassword = encrypt(result.adminPassword, key);
      }
      if (
        result.controlPanelPassword &&
        typeof result.controlPanelPassword === 'string' &&
        !result.controlPanelPassword.includes(':')
      ) {
        result.controlPanelPassword = encrypt(result.controlPanelPassword, key);
      }
      return result;
    } catch (e) {
      return metadata || {};
    }
  }

  private decryptMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') return {};
    try {
      const key = this.getEncryptionKey();
      const result = { ...metadata };
      if (result.rootPassword && typeof result.rootPassword === 'string') {
        const dec = decrypt(result.rootPassword, key);
        if (dec) result.rootPassword = dec;
      }
      if (result.adminPassword && typeof result.adminPassword === 'string') {
        const dec = decrypt(result.adminPassword, key);
        if (dec) result.adminPassword = dec;
      }
      if (
        result.controlPanelPassword &&
        typeof result.controlPanelPassword === 'string'
      ) {
        const dec = decrypt(result.controlPanelPassword, key);
        if (dec) result.controlPanelPassword = dec;
      }
      return result;
    } catch (e) {
      return metadata || {};
    }
  }

  async createAsset(
    createAssetDto: CreateAssetDto,
    user?: any,
  ): Promise<AssetDto> {
    if (user?.userType === 'CUSTOMER' && user?.activeOrganizationId) {
      (createAssetDto as any).organizationId = user.activeOrganizationId;
    }

    // Validate asset type
    if (!this.VALID_TYPES.includes(createAssetDto.type)) {
      throw new BadRequestException(
        `Invalid asset type. Valid options: ${this.VALID_TYPES.join(', ')}`,
      );
    }

    // Validate name is not empty
    if (!createAssetDto.name || createAssetDto.name.trim().length === 0) {
      throw new BadRequestException('Asset name must not be empty');
    }

    // Quota Enforcement: Check server limit if attaching a VPS or BYOVPS server to an organization
    const orgId = (createAssetDto as any).organizationId;
    if (
      orgId &&
      (createAssetDto.type === 'VPS' ||
        (createAssetDto as any).guardianMode === 'BYOVPS') &&
      this.plansEnforcementService
    ) {
      await this.plansEnforcementService.assertCanAttachServer(orgId);
    }

    // Validate billing cycle if provided
    if (
      createAssetDto.billingCycle &&
      !['MONTHLY', 'QUARTERLY', 'ANNUALLY'].includes(
        createAssetDto.billingCycle,
      )
    ) {
      throw new BadRequestException(
        'Invalid billing cycle. Valid options: MONTHLY, QUARTERLY, ANNUALLY',
      );
    }

    // Validate cost is positive if provided
    if (createAssetDto.cost !== undefined && createAssetDto.cost !== null) {
      const costNum = Number(createAssetDto.cost);
      if (isNaN(costNum) || costNum < 0) {
        throw new BadRequestException('Cost must be a positive number');
      }
      createAssetDto.cost = costNum;
    }

    if (createAssetDto.metadata) {
      createAssetDto.metadata = this.encryptMetadata(createAssetDto.metadata);
    }

    if (createAssetDto.renewalDate) {
      const d = new Date(createAssetDto.renewalDate);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Invalid renewal date');
      }
      createAssetDto.renewalDate = d;
    }

    const asset = await this.assetsRepository.create(createAssetDto);
    return this.mapToAssetDto(asset);
  }

  private isManagementUser(user?: any): boolean {
    if (!user || !user.role) return false;
    const role = String(user.role).toUpperCase();
    return [
      'SUPER_ADMIN',
      'ADMIN',
      'CO_FOUNDER',
      'MANAGER',
      'ACCOUNTANT',
    ].includes(role);
  }

  async listAssets(
    query: ListAssetsQuery,
    user?: any,
  ): Promise<ListAssetsResponseDto> {
    // Validate type if provided
    if (query.type && !this.VALID_TYPES.includes(query.type)) {
      throw new BadRequestException(
        `Invalid asset type. Valid options: ${this.VALID_TYPES.join(', ')}`,
      );
    }

    // For non-management users, request all assets from repo so assignment filtering operates across all items
    const fetchQuery = !this.isManagementUser(user)
      ? { ...query, limit: 500 }
      : query;
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const result = await this.assetsRepository.findAll(fetchQuery, userOrgId);

    let assets = result.assets.map((a) => this.mapToAssetListItemDto(a));

    // Scoping & Pricing Protection for non-management users (DEVELOPER, QA, EMPLOYEE)
    if (!this.isManagementUser(user)) {
      // 1. Mask pricing fields
      assets = assets.map((a) => ({
        ...a,
        cost: undefined,
        billingCycle: undefined,
      }));

      // 2. Filter assets to only include assigned assets (Direct assignment OR Project/Task/AMC assignment)
      const userId = user?.id || user?.sub;
      if (userId) {
        const assignedClientIds = new Set<string>();

        try {
          const taskAssignments = await this.prisma.taskAssignment.findMany({
            where: { userId },
            select: {
              task: {
                select: {
                  project: { select: { clientId: true } },
                  amcContract: { select: { clientId: true } },
                },
              },
            },
          });
          taskAssignments.forEach((ta) => {
            if (ta.task?.project?.clientId)
              assignedClientIds.add(ta.task.project.clientId);
            if (ta.task?.amcContract?.clientId)
              assignedClientIds.add(ta.task.amcContract.clientId);
          });
        } catch (e) {
          // ignore task query error
        }

        try {
          const amcModel =
            (this.prisma as any).amcContract ||
            (this.prisma as any).aMCContract;
          if (amcModel && typeof amcModel.findMany === 'function') {
            const assignedAmcs = await amcModel.findMany({
              where: { assignedTechLeadId: userId },
              select: { clientId: true },
            });
            assignedAmcs.forEach((a: any) => {
              if (a.clientId) assignedClientIds.add(a.clientId);
            });
          }
        } catch (e) {
          // ignore amc query error
        }

        assets = assets.filter((a: any) => {
          // Direct assignment check via metadata
          const meta = a.metadata || {};
          if (
            meta.assignedUserId === userId ||
            (Array.isArray(meta.assignedUserIds) &&
              meta.assignedUserIds.includes(userId))
          ) {
            return true;
          }
          // Client/Project task assignment check
          return assignedClientIds.has(a.clientId);
        });
      }
    }

    // Apply renewal status filtering if specified
    if (query.renewalStatus === 'UPCOMING') {
      assets = assets.filter((a) => a.isRenewalUpcoming && !a.isExpired);
    } else if (query.renewalStatus === 'EXPIRED') {
      assets = assets.filter((a) => a.isExpired);
    } else if (query.renewalStatus === 'ACTIVE') {
      assets = assets.filter((a) => !a.isExpired && !a.isRenewalUpcoming);
    }

    return {
      assets,
      total: assets.length,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(assets.length / (result.limit || 20)) || 1,
    };
  }

  async getAssetById(id: string, user?: any): Promise<AssetDto> {
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const asset = await this.assetsRepository.findById(id, userOrgId);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const userId = user?.id || user?.sub;
    // Verify assignment for non-management users
    if (!this.isManagementUser(user) && userId) {
      const meta = (asset.metadata as any) || {};
      const isDirectlyAssigned =
        meta.assignedUserId === userId ||
        (Array.isArray(meta.assignedUserIds) &&
          meta.assignedUserIds.includes(userId));

      if (!isDirectlyAssigned) {
        const assignedClientIds = new Set<string>();

        try {
          const taskAssignments = await this.prisma.taskAssignment.findMany({
            where: { userId },
            select: {
              task: {
                select: {
                  project: { select: { clientId: true } },
                  amcContract: { select: { clientId: true } },
                },
              },
            },
          });
          taskAssignments.forEach((ta) => {
            if (ta.task?.project?.clientId)
              assignedClientIds.add(ta.task.project.clientId);
            if (ta.task?.amcContract?.clientId)
              assignedClientIds.add(ta.task.amcContract.clientId);
          });
        } catch (e) {
          // ignore task query error
        }

        try {
          const amcModel =
            (this.prisma as any).amcContract ||
            (this.prisma as any).aMCContract;
          if (amcModel && typeof amcModel.findMany === 'function') {
            const assignedAmcs = await amcModel.findMany({
              where: { assignedTechLeadId: userId },
              select: { clientId: true },
            });
            assignedAmcs.forEach((a: any) => {
              if (a.clientId) assignedClientIds.add(a.clientId);
            });
          }
        } catch (e) {
          // ignore amc query error
        }

        if (!assignedClientIds.has(asset.clientId)) {
          throw new ForbiddenException(
            'You do not have access to view this asset.',
          );
        }
      }
    }

    const dto = this.mapToAssetDto(asset);
    if (!this.isManagementUser(user)) {
      dto.cost = undefined;
      dto.billingCycle = undefined;
    }
    return dto;
  }

  async updateAsset(
    id: string,
    updateAssetDto: UpdateAssetDto,
    user?: any,
  ): Promise<AssetDto> {
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const asset = await this.assetsRepository.findById(id, userOrgId);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Validate asset type if provided
    if (
      updateAssetDto.type &&
      !this.VALID_TYPES.includes(updateAssetDto.type)
    ) {
      throw new BadRequestException(
        `Invalid asset type. Valid options: ${this.VALID_TYPES.join(', ')}`,
      );
    }

    // Validate name is not empty
    if (updateAssetDto.name && updateAssetDto.name.trim().length === 0) {
      throw new BadRequestException('Asset name must not be empty');
    }

    // Validate billing cycle if provided
    if (
      updateAssetDto.billingCycle &&
      !['MONTHLY', 'QUARTERLY', 'ANNUALLY'].includes(
        updateAssetDto.billingCycle,
      )
    ) {
      throw new BadRequestException(
        'Invalid billing cycle. Valid options: MONTHLY, QUARTERLY, ANNUALLY',
      );
    }

    // Validate cost is positive if provided
    if (updateAssetDto.cost !== undefined && updateAssetDto.cost !== null) {
      const costNum = Number(updateAssetDto.cost);
      if (isNaN(costNum) || costNum < 0) {
        throw new BadRequestException('Cost must be a positive number');
      }
      updateAssetDto.cost = costNum;
    }

    if (updateAssetDto.metadata) {
      updateAssetDto.metadata = this.encryptMetadata(updateAssetDto.metadata);
    }

    if (updateAssetDto.renewalDate) {
      const d = new Date(updateAssetDto.renewalDate);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Invalid renewal date');
      }
      updateAssetDto.renewalDate = d;
    }

    const updated = await this.assetsRepository.update(id, updateAssetDto);
    return this.mapToAssetDto(updated);
  }

  async deleteAsset(id: string, user?: any): Promise<{ message: string }> {
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const asset = await this.assetsRepository.findById(id, userOrgId);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    await this.assetsRepository.softDelete(id);
    return { message: 'Asset deleted successfully' };
  }

  async restoreAsset(id: string, user?: any): Promise<AssetDto> {
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const asset = await this.assetsRepository.findById(id, userOrgId);
    if (!asset || !asset.deletedAt) {
      throw new NotFoundException('Asset not found or is not deleted');
    }

    const restored = await this.assetsRepository.restore(id);
    return this.mapToAssetDto(restored);
  }

  async getUpcomingRenewals(
    daysThreshold: number = 30,
    user?: any,
  ): Promise<UpcomingRenewalDto[]> {
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const assets = await this.assetsRepository.findUpcomingRenewals(
      daysThreshold,
      userOrgId,
    );

    return assets.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      clientId: a.clientId,
      clientName: a.client?.name || 'Unknown',
      renewalDate: a.renewalDate || new Date(),
      daysUntilRenewal: this.calculateDaysUntilRenewal(a.renewalDate) || 0,
      cost: a.cost ?? undefined,
      billingCycle: (a.billingCycle as any) ?? undefined,
    }));
  }

  async getExpiredAssets(user?: any): Promise<AssetDto[]> {
    const userOrgId =
      user?.userType === 'CUSTOMER' ? user.activeOrganizationId : undefined;
    const assets = await this.assetsRepository.findExpiredAssets(userOrgId);
    return assets.map((a) => this.mapToAssetDto(a));
  }

  async resetPassword(
    id: string,
    resetPasswordDto: ResetPasswordDto,
    userRole: string,
  ): Promise<{ message: string }> {
    // Only SUPER_ADMIN and MANAGER can reset passwords
    if (!['SUPER_ADMIN', 'MANAGER'].includes(userRole)) {
      throw new ForbiddenException('Only admins can reset passwords');
    }

    const asset = await this.assetsRepository.findById(id);
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    // Validate password is not empty
    if (
      !resetPasswordDto.newPassword ||
      resetPasswordDto.newPassword.trim().length === 0
    ) {
      throw new BadRequestException('New password must not be empty');
    }

    const metadata = this.decryptMetadata(asset.metadata || {});

    // Update the appropriate password field based on credential type
    if (resetPasswordDto.credentialType === 'ROOT') {
      if (!metadata.rootPassword) {
        throw new BadRequestException(
          'This asset does not have root credentials',
        );
      }
      metadata.rootPassword = resetPasswordDto.newPassword;
    } else if (resetPasswordDto.credentialType === 'ADMIN') {
      if (!metadata.adminPassword) {
        throw new BadRequestException(
          'This asset does not have admin credentials',
        );
      }
      metadata.adminPassword = resetPasswordDto.newPassword;
    } else if (resetPasswordDto.credentialType === 'CONTROL_PANEL') {
      if (!metadata.controlPanelPassword) {
        throw new BadRequestException(
          'This asset does not have control panel credentials',
        );
      }
      metadata.controlPanelPassword = resetPasswordDto.newPassword;
    } else {
      throw new BadRequestException(
        'Invalid credential type. Valid options: ROOT, ADMIN, CONTROL_PANEL',
      );
    }

    const encryptedMetadata = this.encryptMetadata(metadata);
    await this.assetsRepository.update(id, { metadata: encryptedMetadata });
    return { message: 'Password updated successfully' };
  }

  private calculateDaysUntilRenewal(
    renewalDate: Date | null,
  ): number | undefined {
    if (!renewalDate) return undefined;
    const now = new Date();
    const timeDiff = new Date(renewalDate).getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  private isRenewalUpcoming(renewalDate: Date | null): boolean {
    if (!renewalDate) return false;
    const daysUntil = this.calculateDaysUntilRenewal(renewalDate);
    return (
      daysUntil !== undefined &&
      daysUntil <= this.RENEWAL_THRESHOLD_DAYS &&
      daysUntil > 0
    );
  }

  private isExpired(renewalDate: Date | null): boolean {
    if (!renewalDate) return false;
    const daysUntil = this.calculateDaysUntilRenewal(renewalDate);
    return daysUntil !== undefined && daysUntil <= 0;
  }

  private mapToAssetDto(asset: any): AssetDto {
    return {
      id: asset.id,
      clientId: asset.clientId,
      name: asset.name,
      type: asset.type,
      description: asset.description,
      metadata: this.decryptMetadata(asset.metadata || {}),
      renewalDate: asset.renewalDate,
      daysUntilRenewal: this.calculateDaysUntilRenewal(asset.renewalDate),
      isRenewalUpcoming: this.isRenewalUpcoming(asset.renewalDate),
      isExpired: this.isExpired(asset.renewalDate),
      cost: asset.cost,
      billingCycle: asset.billingCycle,
      notes: asset.notes,
      guardianMode: asset.guardianMode,
      guardianOwnership: asset.guardianOwnership,
      guardianAgentId: asset.guardianAgentId ?? null,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
      client: asset.client,
    };
  }

  private mapToAssetListItemDto(asset: any) {
    return {
      id: asset.id,
      clientId: asset.clientId,
      name: asset.name,
      type: asset.type,
      metadata: this.decryptMetadata(asset.metadata || {}),
      renewalDate: asset.renewalDate,
      daysUntilRenewal: this.calculateDaysUntilRenewal(asset.renewalDate),
      isRenewalUpcoming: this.isRenewalUpcoming(asset.renewalDate),
      isExpired: this.isExpired(asset.renewalDate),
      cost: asset.cost,
      billingCycle: asset.billingCycle,
      notes: asset.notes,
      description: asset.description,
      guardianMode: asset.guardianMode,
      guardianOwnership: asset.guardianOwnership,
      createdAt: asset.createdAt,
      client: asset.client,
    };
  }
}
