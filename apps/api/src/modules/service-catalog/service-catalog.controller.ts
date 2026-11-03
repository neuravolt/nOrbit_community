import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ServiceCatalogService } from './service-catalog.service';
import {
  CreateServiceDto,
  UpdateServiceDto,
  UpsertRateCardDto,
  CreateBundleDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('service-catalog')
@UseGuards(JwtAuthGuard)
export class ServiceCatalogController {
  constructor(private readonly serviceCatalogService: ServiceCatalogService) {}

  @Get()
  list(
    @Query('category') category?: string,
    @Query('subCategory') subCategory?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.serviceCatalogService.listServices(
      category,
      subCategory,
      activeOnly !== 'false',
    );
  }

  @Get('categories')
  getCategories() {
    return this.serviceCatalogService.getCategories();
  }

  @Get('bundles')
  listBundles() {
    return this.serviceCatalogService.listBundles();
  }

  @Post('seed')
  seed() {
    return this.serviceCatalogService.seed();
  }

  @Post('bundles')
  createBundle(@Body() dto: CreateBundleDto) {
    return this.serviceCatalogService.createBundle(dto);
  }

  @Post('rate-cards')
  upsertRateCard(@Body() dto: UpsertRateCardDto) {
    return this.serviceCatalogService.upsertRateCard(dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.serviceCatalogService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.serviceCatalogService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.serviceCatalogService.update(id, dto);
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.serviceCatalogService.deactivate(id);
  }
}
