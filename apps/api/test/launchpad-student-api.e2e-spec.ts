import { WsAdapter } from '@nestjs/platform-ws';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Launchpad Student API Integration Tests (E2E)', () => {
  let app: INestApplication;
  let studentToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Same adapter main.ts registers; without it Nest looks for socket.io and exits.

    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();

    // Login mock student or retrieve session token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'student@neuravolt.in', password: 'password123' })
      .expect(200);

    studentToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('should retrieve student dashboard', () => {
    return request(app.getHttpServer())
      .get('/api/student/dashboard')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.student).toBeDefined();
        expect(res.body.data.technologies).toBeDefined();
      });
  });

  it('should list careers available to select', () => {
    return request(app.getHttpServer())
      .get('/api/student/careers')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200)
      .then((res) => {
        expect(res.body.success).toBe(true);
        expect(Array.isArray(res.body.data)).toBe(true);
      });
  });
});
