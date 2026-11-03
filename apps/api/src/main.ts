import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import * as dotenv from 'dotenv';
import * as path from 'path';
import helmet from 'helmet';
import compression from 'compression';

// Load root .env
dotenv.config({ path: path.join(__dirname, '../../../../.env') });
// Also load local .env if exists
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.useWebSocketAdapter(new WsAdapter(app));
  // Behind nginx on the same host: take the client address from X-Forwarded-For, but only when the
  // request comes from a local/private proxy, so rate limits count real visitors, not the proxy.
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', 'loopback, linklocal, uniquelocal');

  // Body size limit: 10MB is sufficient for all API payloads.
  // Large file uploads (images, videos, biometric frames) must use
  // multipart/form-data via dedicated upload endpoints, not raw JSON.
  const express = require('express');
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res: any, buf: Buffer) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Generated HR documents (offer letters, payslips, …) must not be readable by anyone who
  // has the URL. Registered before ServeStaticModule's /uploads handler (which is added at
  // app init), so these files are only reachable via GET /hr/documents/:id/file.
  app.use('/uploads/hr-documents', (_req: any, res: any) =>
    res.status(404).end(),
  );

  // Apply Global Validation Pipes
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Apply Helmet middleware for security headers
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // needed if loading assets from outside
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // can be tweaked for swagger/graphql if needed
    }),
  );

  // Apply Compression middleware for response compression
  app.use(compression());

  // Enable CORS for frontend requests
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:3003'],
    credentials: true,
  });

  // Enable graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.API_PORT || process.env.PORT || 3001;
  console.log(`Starting API server on port ${port}...`);
  await app.listen(port);
}
bootstrap();
