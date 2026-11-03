import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Launchpad - Node Completion Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Same adapter main.ts registers; without it Nest looks for socket.io and exits.

    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should verify the complete end-to-end node completion flow', async () => {
    // 1. Setup mock data
    const student = await prisma.user.create({
      data: {
        email: 'test-student-flow@example.com',
        firstName: 'Test',
        lastName: 'Student',
        passwordHash: 'hashedpwd',
        role: 'CLIENT', // RoleField has no STUDENT; student shadow Users use CLIENT
      },
    });

    const career = await prisma.career.create({
      data: {
        name: 'Technology',
        slug: 'tech-flow',
        isActive: true,
      },
    });

    const careerRole = await prisma.careerRole.create({
      data: {
        careerId: career.id,
        name: 'Node Developer',
        slug: 'node-dev-flow',
        isActive: true,
      },
    });

    const technology = await prisma.technology.create({
      data: {
        careerRoleId: careerRole.id,
        name: 'Node.js',
        slug: 'nodejs-flow',
        isActive: true,
      },
    });

    const level = await prisma.technologyLevel.create({
      data: {
        technologyId: technology.id,
        levelNumber: 1,
        name: 'Foundations',
        difficulty: 'BEGINNER',
        isActive: true,
      },
    });

    const node1 = await prisma.roadmapNode.create({
      data: {
        technologyLevelId: level.id,
        nodeNumber: 1,
        title: 'Git Basics',
        slug: 'git-basics-flow',
        status: 'published',
        xpReward: 100,
        coinsReward: 50,
      },
    });

    const node2 = await prisma.roadmapNode.create({
      data: {
        technologyLevelId: level.id,
        nodeNumber: 2,
        title: 'Advanced Git',
        slug: 'advanced-git-flow',
        status: 'published',
        xpReward: 150,
        coinsReward: 75,
      },
    });

    // 2. Select Career and Role
    await prisma.user.update({
      where: { id: student.id },
      data: {
        currentCareerId: career.id,
        currentRoleId: careerRole.id,
      },
    });

    // Initialize node progress
    await prisma.studentNodeProgress.create({
      data: {
        studentId: student.id,
        nodeId: node1.id,
        status: 'challenge_completed',
      },
    });

    // 3. Complete Node 1 via mentor connector approval
    const mentorConnector = app.get('MentorConnectorService');
    await mentorConnector.onMentorApproval(
      student.id,
      node1.id,
      true,
      'Approved by mentor',
    );

    // 4. Verification assertions
    const updatedProgress = await prisma.studentNodeProgress.findUnique({
      where: {
        studentId_nodeId: {
          studentId: student.id,
          nodeId: node1.id,
        },
      },
    });

    expect(updatedProgress).toBeDefined();
    expect(updatedProgress!.status).toBe('completed');
    expect(updatedProgress!.xpAwarded).toBe(100);
    expect(updatedProgress!.coinsAwarded).toBe(50);
    expect(updatedProgress!.evidenceId).toBeDefined();

    // Verify next node is unlocked (available)
    const nextNodeProgress = await prisma.studentNodeProgress.findUnique({
      where: {
        studentId_nodeId: {
          studentId: student.id,
          nodeId: node2.id,
        },
      },
    });

    expect(nextNodeProgress).toBeDefined();
    expect(nextNodeProgress!.status).toBe('available');

    // Cleanup
    await prisma.studentNodeProgress.deleteMany({
      where: { studentId: student.id },
    });
    await prisma.roadmapNode.deleteMany({
      where: { technologyLevelId: level.id },
    });
    await prisma.technologyLevel.deleteMany({
      where: { technologyId: technology.id },
    });
    await prisma.technology.deleteMany({
      where: { careerRoleId: careerRole.id },
    });
    await prisma.careerRole.deleteMany({ where: { careerId: career.id } });
    await prisma.career.deleteMany({ where: { id: career.id } });
    await prisma.user.delete({ where: { id: student.id } });
  });
});
