import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

export interface CreateTopicInput {
  sortOrder?: number;
  title: string;
  learningObjectives?: unknown;
  prerequisiteTopicIds?: string[];
  status?: string;
}

export interface UpdateTopicInput {
  sortOrder?: number;
  title?: string;
  learningObjectives?: unknown;
  prerequisiteTopicIds?: string[];
  status?: string;
}

// A node's teaching/assessment fields live on the row itself once published, but the AI review
// pipeline writes each stage's output into draftContent first (saveDraft) — pending admin
// approval. "What's actually been generated" for the tree view means either location, so every
// flag below checks the live field OR the same key inside draftContent.
const CONTENT_FIELD_SELECT = {
  id: true,
  title: true,
  status: true,
  notes: true,
  cheatsheet: true,
  quizQuestions: true,
  codingChallenge: true,
  miniProject: true,
  aiInterviewQuestions: true,
  validationRules: true,
  draftContent: true,
} as const;

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return !!value && typeof value === 'object' && Object.keys(value).length > 0;
}

export function computeGenerationStatus(node: Record<string, any>): {
  content: boolean;
  quiz: boolean;
  challenge: boolean;
  interview: boolean;
  miniProject: boolean;
  hiddenTests: boolean;
} {
  const draft = (node.draftContent as Record<string, any>) || {};
  const merged = { ...node, ...draft };
  return {
    content: hasText(merged.notes) || hasText(merged.cheatsheet),
    quiz: hasItems(merged.quizQuestions),
    challenge: hasItems(merged.codingChallenge),
    interview: hasItems(merged.aiInterviewQuestions),
    miniProject: hasItems(merged.miniProject),
    hiddenTests: hasItems(merged.validationRules),
  };
}

/**
 * Launchpad Phase 5B, Slice 5B-2. Minimal CRUD over LaunchpadTopic — same scope discipline as
 * ChapterService: the data foundation for this slice, not an admin API surface.
 */
@Injectable()
export class TopicService {
  constructor(private prisma: PrismaService) {}

  // Includes each topic's node shell so the admin Syllabus UI can link straight from a Topic
  // into its content editor (/admin/nodes/:id/edit) — Stage 3's approval (ai-orchestration.
  // service.ts) already creates exactly one LaunchpadRoadmapNode per topic, so this is
  // read-only, no new relationship. Also computes generationStatus per node (Content/Quiz/
  // Challenge/Interview/Mini-Project/Hidden-Tests flags) for the curriculum tree view.
  async findByChapter(chapterId: string) {
    const topics = await this.prisma.launchpadTopic.findMany({
      where: { chapterId },
      orderBy: { sortOrder: 'asc' },
      include: { nodes: { select: CONTENT_FIELD_SELECT } },
    });
    return topics.map((topic) => ({
      ...topic,
      nodes: topic.nodes.map((node) => {
        const generationStatus = computeGenerationStatus(
          node as Record<string, any>,
        );
        const { draftContent: _draftContent, ...rest } = node;
        return { ...rest, generationStatus };
      }),
    }));
  }

  async findOne(id: string) {
    const topic = await this.prisma.launchpadTopic.findUnique({
      where: { id },
    });
    if (!topic) {
      throw new NotFoundException('Topic not found');
    }
    return topic;
  }

  async create(chapterId: string, dto: CreateTopicInput) {
    return this.prisma.launchpadTopic.create({
      data: {
        chapterId,
        title: dto.title,
        learningObjectives: dto.learningObjectives as any,
        prerequisiteTopicIds: (dto.prerequisiteTopicIds ?? []) as any,
        sortOrder: dto.sortOrder ?? 1,
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });
  }

  async update(id: string, dto: UpdateTopicInput) {
    return this.prisma.launchpadTopic.update({
      where: { id },
      data: dto as any,
    });
  }
}
