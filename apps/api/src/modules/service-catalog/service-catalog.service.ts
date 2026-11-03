import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  UpsertRateCardDto,
  CreateBundleDto,
} from './dto';
import { ServiceUnitType, ClientTier } from '@prisma/client';

@Injectable()
export class ServiceCatalogService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Services ──────────────────────────────────────────────────────────────

  async listServices(
    category?: string,
    subCategory?: string,
    activeOnly = true,
  ) {
    const where: any = {};
    if (activeOnly) where.isActive = true;
    if (category) where.category = category;
    if (subCategory) where.subCategory = subCategory;

    const services = await this.prisma.serviceCatalog.findMany({
      where,
      include: { rateCards: true },
      orderBy: [{ category: 'asc' }, { subCategory: 'asc' }, { name: 'asc' }],
    });

    // Group by category → subCategory
    const grouped: Record<string, Record<string, any[]>> = {};
    for (const svc of services) {
      if (!grouped[svc.category]) grouped[svc.category] = {};
      if (!grouped[svc.category][svc.subCategory])
        grouped[svc.category][svc.subCategory] = [];
      grouped[svc.category][svc.subCategory].push(svc);
    }
    return { services, grouped };
  }

  async getCategories() {
    const rows = await this.prisma.serviceCatalog.findMany({
      where: { isActive: true },
      select: { category: true, subCategory: true },
      distinct: ['category', 'subCategory'],
      orderBy: [{ category: 'asc' }, { subCategory: 'asc' }],
    });

    const map: Record<string, string[]> = {};
    for (const r of rows) {
      if (!map[r.category]) map[r.category] = [];
      if (!map[r.category].includes(r.subCategory))
        map[r.category].push(r.subCategory);
    }
    return map;
  }

  async getById(id: string) {
    const svc = await this.prisma.serviceCatalog.findUnique({
      where: { id },
      include: { rateCards: true },
    });
    if (!svc) throw new NotFoundException(`Service ${id} not found`);
    return svc;
  }

  async create(dto: CreateServiceDto) {
    const exists = await this.prisma.serviceCatalog.findUnique({
      where: { serviceCode: dto.serviceCode },
    });
    if (exists)
      throw new ConflictException(
        `Service code ${dto.serviceCode} already exists`,
      );
    return this.prisma.serviceCatalog.create({
      data: {
        serviceCode: dto.serviceCode,
        category: dto.category,
        subCategory: dto.subCategory,
        name: dto.name,
        description: dto.description,
        basePrice: dto.basePrice ?? 0,
        costPrice: dto.costPrice ?? 0,
        gstRate: dto.gstRate ?? 18,
        unitType: dto.unitType
          ? (dto.unitType.toUpperCase() as ServiceUnitType)
          : undefined,
      },
      include: { rateCards: true },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.getById(id);
    return this.prisma.serviceCatalog.update({
      where: { id },
      data: {
        ...dto,
        unitType: dto.unitType
          ? (dto.unitType.toUpperCase() as ServiceUnitType)
          : undefined,
      },
      include: { rateCards: true },
    });
  }

  async deactivate(id: string) {
    await this.getById(id);
    return this.prisma.serviceCatalog.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ── Rate Cards ────────────────────────────────────────────────────────────

  async upsertRateCard(dto: UpsertRateCardDto) {
    await this.getById(dto.serviceId);
    return this.prisma.serviceRateCard.upsert({
      where: {
        serviceId_clientTier: {
          serviceId: dto.serviceId,
          clientTier: dto.clientTier as ClientTier,
        },
      },
      create: {
        serviceId: dto.serviceId,
        clientTier: dto.clientTier as ClientTier,
        customPrice: dto.customPrice,
        discountPercent: dto.discountPercent ?? 0,
      },
      update: {
        customPrice: dto.customPrice,
        discountPercent: dto.discountPercent ?? 0,
      },
    });
  }

  async getPriceForClient(
    serviceId: string,
    clientTier: string,
  ): Promise<number> {
    const svc = await this.getById(serviceId);
    const rateCard = svc.rateCards?.find(
      (rc: any) => rc.clientTier === clientTier,
    );
    if (rateCard) {
      const discounted =
        Number(rateCard.customPrice) *
        (1 - Number(rateCard.discountPercent) / 100);
      return Math.round(discounted * 100) / 100;
    }
    return Number(svc.basePrice);
  }

  // ── Bundles ───────────────────────────────────────────────────────────────

  async listBundles() {
    return this.prisma.serviceBundle.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createBundle(dto: CreateBundleDto) {
    return this.prisma.serviceBundle.create({
      data: {
        name: dto.name,
        description: dto.description,
        services: dto.services as any,
        totalPrice: dto.totalPrice,
      },
    });
  }

  // Seed common services for Neuravolt
  async seed() {
    const services = [
      {
        serviceCode: 'SWD-WEB-001',
        category: 'Software Development',
        subCategory: 'Web App',
        name: 'Custom Web Application',
        description: 'Full-stack web application development',
        unitType: ServiceUnitType.FIXED,
        basePrice: 50000,
        costPrice: 30000,
        gstRate: 18,
      },
      {
        serviceCode: 'SWD-MOB-001',
        category: 'Software Development',
        subCategory: 'Mobile App',
        name: 'Android App Development',
        description: 'Native Android application development',
        unitType: ServiceUnitType.FIXED,
        basePrice: 40000,
        costPrice: 25000,
        gstRate: 18,
      },
      {
        serviceCode: 'SWD-MOB-002',
        category: 'Software Development',
        subCategory: 'Mobile App',
        name: 'iOS App Development',
        description: 'Native iOS application development',
        unitType: ServiceUnitType.FIXED,
        basePrice: 45000,
        costPrice: 28000,
        gstRate: 18,
      },
      {
        serviceCode: 'SWD-MOB-003',
        category: 'Software Development',
        subCategory: 'Mobile App',
        name: 'React Native App',
        description: 'Cross-platform mobile app using React Native',
        unitType: ServiceUnitType.FIXED,
        basePrice: 55000,
        costPrice: 35000,
        gstRate: 18,
      },
      {
        serviceCode: 'SWD-API-001',
        category: 'Software Development',
        subCategory: 'Backend',
        name: 'REST API Development',
        description: 'Node.js/NestJS REST API development',
        unitType: ServiceUnitType.FIXED,
        basePrice: 30000,
        costPrice: 18000,
        gstRate: 18,
      },
      {
        serviceCode: 'SWD-UI-001',
        category: 'Software Development',
        subCategory: 'Frontend',
        name: 'UI/UX Design + Development',
        description: 'Figma design + React frontend implementation',
        unitType: ServiceUnitType.FIXED,
        basePrice: 25000,
        costPrice: 15000,
        gstRate: 18,
      },
      {
        serviceCode: 'AMC-SUP-001',
        category: 'Maintenance & Support',
        subCategory: 'AMC',
        name: 'Annual Maintenance Contract',
        description: 'Monthly maintenance and support hours',
        unitType: ServiceUnitType.HOUR,
        basePrice: 1500,
        costPrice: 800,
        gstRate: 18,
      },
      {
        serviceCode: 'AMC-HRS-001',
        category: 'Maintenance & Support',
        subCategory: 'Ad-hoc Support',
        name: 'Ad-hoc Development Hours',
        description: 'Additional development hours on demand',
        unitType: ServiceUnitType.HOUR,
        basePrice: 1500,
        costPrice: 800,
        gstRate: 18,
      },
      {
        serviceCode: 'INF-VPS-001',
        category: 'Infrastructure',
        subCategory: 'Server',
        name: 'VPS Server Setup',
        description: 'Server provisioning, configuration, and deployment',
        unitType: ServiceUnitType.FIXED,
        basePrice: 8000,
        costPrice: 4000,
        gstRate: 18,
      },
      {
        serviceCode: 'INF-DOM-001',
        category: 'Infrastructure',
        subCategory: 'Domain',
        name: 'Domain Registration',
        description: 'Domain name registration and DNS setup',
        unitType: ServiceUnitType.FIXED,
        basePrice: 1500,
        costPrice: 800,
        gstRate: 18,
      },
      {
        serviceCode: 'INF-SSL-001',
        category: 'Infrastructure',
        subCategory: 'SSL',
        name: 'SSL Certificate Setup',
        description: 'SSL/TLS certificate installation and configuration',
        unitType: ServiceUnitType.FIXED,
        basePrice: 2000,
        costPrice: 500,
        gstRate: 18,
      },
      {
        serviceCode: 'DIG-SEO-001',
        category: 'Digital Marketing',
        subCategory: 'SEO',
        name: 'SEO Optimization',
        description: 'On-page and off-page SEO optimization',
        unitType: ServiceUnitType.MONTHLY,
        basePrice: 8000,
        costPrice: 4000,
        gstRate: 18,
      },
    ];

    let created = 0;
    for (const svc of services) {
      const exists = await this.prisma.serviceCatalog.findUnique({
        where: { serviceCode: svc.serviceCode },
      });
      if (!exists) {
        await this.prisma.serviceCatalog.create({ data: svc });
        created++;
      }
    }
    return { seeded: created, total: services.length };
  }
}
