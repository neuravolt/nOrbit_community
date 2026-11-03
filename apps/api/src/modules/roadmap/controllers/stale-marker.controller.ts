import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { StaleMarkerService } from '../services/stale-marker.service';
import { ResolveStaleMarkerDto } from '../dto/resolve-stale-marker.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../../users/guards/roles.guard';

// Slice 5B-12: same guard/RBAC pattern as every other admin controller in this module.
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(['SUPER_ADMIN', 'MANAGER'])
export class StaleMarkerController {
  constructor(private service: StaleMarkerService) {}

  @Get('nodes/:nodeId/stale-markers/:entityType')
  async listUnresolved(
    @Param('nodeId') nodeId: string,
    @Param('entityType') entityType: string,
  ) {
    const data = await this.service.listUnresolved(entityType, nodeId);
    return {
      success: true,
      data,
      message: 'Unresolved stale markers retrieved successfully',
    };
  }

  @Post('stale-markers/:id/resolve')
  async resolve(@Param('id') id: string, @Body() dto: ResolveStaleMarkerDto) {
    const data = await this.service.resolve(id, dto.decision);
    return { success: true, data, message: 'Stale marker resolved.' };
  }
}
