"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppConfig = void 0;
exports.AppConfig = {
    apiPort: process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3001,
    webPort: process.env.WEB_PORT ? parseInt(process.env.WEB_PORT, 10) : 3000,
    workerPort: process.env.WORKER_PORT ? parseInt(process.env.WORKER_PORT, 10) : 3002,
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/neuravolt',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
};
//# sourceMappingURL=index.js.map