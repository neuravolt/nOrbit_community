import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StudentJwtAuthGuard } from '../launchpad/guards/student-auth.guard';
import { RoadmapService } from './roadmap.service';

@Controller('launchpad/student')
@UseGuards(StudentJwtAuthGuard)
export class RoadmapController {
  constructor(private readonly roadmapService: RoadmapService) {}

  @Get('careers')
  async getCareers() {
    return this.roadmapService.getCareers();
  }

  @Get('careers/:id/roles')
  async getRoles(@Param('id') careerId: string) {
    return this.roadmapService.getRolesByCareer(careerId);
  }

  @Get('roles/:id/technologies')
  async getTechnologies(@Param('id') roleId: string, @Req() req: any) {
    return this.roadmapService.getTechnologiesByRole(roleId, req.user.id);
  }

  @Get('technologies/:id/tree')
  async getTechnologyTree(@Param('id') technologyId: string, @Req() req: any) {
    return this.roadmapService.getTechnologyTree(technologyId, req.user.id);
  }

  @Get('nodes/:id')
  async getNodeDetails(@Param('id') nodeId: string, @Req() req: any) {
    return this.roadmapService.getNodeDetails(nodeId, req.user.id);
  }

  @Post('nodes/:id/quiz/submit')
  async submitQuiz(
    @Param('id') nodeId: string,
    @Body()
    body: { answers: { questionIndex: number; selectedOption: number }[] },
    @Req() req: any,
  ) {
    return this.roadmapService.submitQuiz(nodeId, req.user.id, body.answers);
  }
}
