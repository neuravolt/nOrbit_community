const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { GuardianService } = require('./dist/modules/guardian/guardian.service');

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(GuardianService);
  
  try {
    const payload = {
      cpuPercent: 50,
      ramUsedMB: 2000,
      ramTotalMB: 16000,
      websites: [
        {
          domain: 'vinns.in',
          cpuPercent: 5,
          ramUsedMB: 128,
          ramTotalMB: 16000,
          visitorsPerMin: 10
        }
      ]
    };
    console.log('Testing processHeartbeat...');
    await service.processHeartbeat('agent-n8n-vps', payload);
    console.log('Heartbeat processed successfully!');
  } catch (err) {
    console.error('ERROR during processHeartbeat:', err);
  } finally {
    await app.close();
  }
}

run();
