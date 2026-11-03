import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Launchpad Admin API Integration Tests (E2E)', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Same adapter main.ts registers; without it Nest looks for socket.io and exits.

    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();

    // Acquire admin jwt authorization token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@neuravolt.in', password: 'password123' })
      .expect(200);

    adminToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should list all careers for administrator', () => {
    return request(app.getHttpServer())
      .get('/api/admin/careers')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });

  it('should support creating and updating careers', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/api/admin/careers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'New Incubation Career Track',
        slug: 'new-inc-track',
        description: 'AI specialized roadmap tracks.',
        color: '#E0E0E0',
      })
      .expect(201);

    const careerId = createRes.body.data.id;

    await request(app.getHttpServer())
      .put(`/api/admin/careers/${careerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Updated Incubation Career Track',
      })
      .expect(200);

    // Clean up
    await request(app.getHttpServer())
      .delete(`/api/admin/careers/${careerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
