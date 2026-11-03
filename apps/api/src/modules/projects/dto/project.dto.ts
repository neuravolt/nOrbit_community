export class MilestoneDto {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  dueDate?: Date;
  completedAt?: Date;
  status: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectDto {
  id: string;
  clientId: string;
  client?: any;
  name: string;
  description?: string;
  status: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  key?: string;
  githubRepo?: string;
  githubRepoId?: string;
  githubInstallationId?: string;
  githubDefaultBranch?: string;
  milestones: MilestoneDto[];
  tasks?: any[];
  tickets?: any[];
  attachments?: any[];
  taskCount: number;
  timeLogged: number; // in minutes or hours
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectListItemDto {
  id: string;
  clientId: string;
  name: string;
  status: string;
  key?: string;
  githubRepo?: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  milestoneCount: number;
  taskCount: number;
  createdAt: Date;
}

export class ListProjectsResponseDto {
  projects: ProjectListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}
