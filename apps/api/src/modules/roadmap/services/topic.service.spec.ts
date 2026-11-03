import { NotFoundException } from '@nestjs/common';
import { TopicService, computeGenerationStatus } from './topic.service';

describe('TopicService', () => {
  let service: TopicService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      launchpadTopic: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new TopicService(prismaMock);
  });

  it("findByChapter orders by sortOrder ascending, scoped to the given chapter, selecting each node's content fields", async () => {
    prismaMock.launchpadTopic.findMany.mockResolvedValue([]);
    await service.findByChapter('chapter-1');
    expect(prismaMock.launchpadTopic.findMany).toHaveBeenCalledWith({
      where: { chapterId: 'chapter-1' },
      orderBy: { sortOrder: 'asc' },
      include: {
        nodes: {
          select: {
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
          },
        },
      },
    });
  });

  it('findByChapter attaches a computed generationStatus per node and strips the raw draftContent', async () => {
    prismaMock.launchpadTopic.findMany.mockResolvedValue([
      {
        id: 'topic-1',
        nodes: [
          {
            id: 'node-1',
            title: 'Closures',
            status: 'draft',
            notes: '',
            cheatsheet: '',
            quizQuestions: [],
            codingChallenge: {},
            miniProject: {},
            aiInterviewQuestions: [],
            validationRules: [],
            draftContent: {
              notes: 'Closures capture scope.',
              quizQuestions: [{ q: 'What is a closure?' }],
            },
          },
        ],
      },
    ]);
    const [topic] = await service.findByChapter('chapter-1');
    expect(topic.nodes[0]).not.toHaveProperty('draftContent');
    expect(topic.nodes[0].generationStatus).toEqual({
      content: true,
      quiz: true,
      challenge: false,
      interview: false,
      miniProject: false,
      hiddenTests: false,
    });
  });

  it('findOne throws NotFoundException for a missing topic', async () => {
    prismaMock.launchpadTopic.findUnique.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('create defaults prerequisiteTopicIds to an empty array when not supplied', async () => {
    prismaMock.launchpadTopic.create.mockResolvedValue({});
    await service.create('chapter-1', { title: 'Event Loop' });
    expect(prismaMock.launchpadTopic.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chapterId: 'chapter-1',
        title: 'Event Loop',
        prerequisiteTopicIds: [],
        sortOrder: 1,
      }),
    });
  });
});

describe('computeGenerationStatus', () => {
  it('reads published (live) fields when there is no pending draft', () => {
    const status = computeGenerationStatus({
      notes: 'Published notes',
      cheatsheet: '',
      quizQuestions: [{ q: 'x' }],
      codingChallenge: { objective: 'Build a queue' },
      miniProject: {},
      aiInterviewQuestions: [],
      validationRules: { rules: ['no globals'] },
      draftContent: null,
    });
    expect(status).toEqual({
      content: true,
      quiz: true,
      challenge: true,
      interview: false,
      miniProject: false,
      hiddenTests: true,
    });
  });

  it('treats an empty node as nothing generated', () => {
    const status = computeGenerationStatus({
      notes: '',
      cheatsheet: '',
      quizQuestions: [],
      codingChallenge: {},
      miniProject: {},
      aiInterviewQuestions: [],
      validationRules: {},
      draftContent: null,
    });
    expect(Object.values(status).every((v) => v === false)).toBe(true);
  });
});
