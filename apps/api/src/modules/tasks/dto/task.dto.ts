export class AssignmentDto {
  id: string;
  taskId: string;
  userId: string;
  assignedAt: Date;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export class CommentDto {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export class TimeLogDto {
  id: string;
  taskId: string;
  userId: string;
  projectId: string;
  description?: string;
  hours: number;
  logDate: Date;
  createdAt: Date;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

export class SubtaskDto {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date;
  estimatedHours?: number;
}

export class TaskDto {
  id: string;
  projectId: string;
  milestoneId?: string;
  parentId?: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: Date;
  estimatedHours?: number;
  assignments: AssignmentDto[];
  comments: CommentDto[];
  timeLogs: TimeLogDto[];
  subtasks: SubtaskDto[];
  totalTimeLogged: number;
  createdAt: Date;
  updatedAt: Date;
  ticketId?: string;
  taskCode?: string;
  githubBranch?: string;
  pullRequests?: any[];
  project?: {
    id: string;
    name: string;
  };
  attachments?: any[];
}

export class TaskListItemDto {
  id: string;
  projectId: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: Date;
  estimatedHours?: number;
  assigneeCount: number;
  commentCount: number;
  subtaskCount: number;
  totalTimeLogged: number;
  createdAt: Date;
  ticketId?: string;
  taskCode?: string;
  githubBranch?: string;
  pullRequests?: any[];
  project?: { id: string; name: string };
  assignments?: AssignmentDto[];
}

export class ListTasksResponseDto {
  tasks: TaskListItemDto[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}
