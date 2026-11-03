import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common';
import { PermissionsModule } from './modules/permissions';
import { RolesModule } from './modules/roles';
import { AuthModule } from './modules/auth';
import { UsersModule } from './modules/users';
import { ClientsModule } from './modules/clients';
import { LeadsModule } from './modules/leads';
import { ProjectsModule } from './modules/projects';
import { TasksModule } from './modules/tasks';
import { TicketsModule } from './modules/tickets';
import { AssetsModule } from './modules/assets';
import { AmcModule } from './modules/amc';
import { SalesModule } from './modules/sales';
import { BillingModule } from './modules/billing';
import { NotificationsModule } from './modules/notifications';
import { ReportsModule } from './modules/reports';
import { QaModule } from './modules/qa';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { CompanyProfileModule } from './modules/company-profile/company-profile.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ServiceCatalogModule } from './modules/service-catalog/service-catalog.module';
import { EmailTemplatesModule } from './modules/email-templates';
import { GithubModule } from './modules/github/github.module';
import { RoadmapModule } from './modules/roadmap/roadmap.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { HrModule } from './modules/hr/hr.module';
import { HrmsModule } from './modules/hrms/hrms.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { MailboxModule } from './modules/mailbox/mailbox.module';
import { ChatModule } from './modules/chat/chat.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { PlansModule } from './modules/plans/plans.module';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { AdvancedThrottlerGuard } from './common/guards/advanced-throttler.guard';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    PermissionsModule,
    BullModule.forRootAsync({
      useFactory: () => {
        if (process.env.REDIS_HOST) {
          return {
            connection: {
              host: process.env.REDIS_HOST,
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
            },
          };
        }
        return {
          connection: {
            url: process.env.REDIS_URL || 'redis://localhost:6379',
          },
        };
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ...(process.env.SERVE_STATIC_UPLOADS === 'true'
      ? [
          ServeStaticModule.forRoot({
            rootPath:
              process.env.STORAGE_PATH || join(__dirname, '..', 'uploads'),
            serveRoot: '/uploads',
          }),
        ]
      : []),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    RolesModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    LeadsModule,
    ProjectsModule,
    TasksModule,
    TicketsModule,
    AssetsModule,
    AmcModule,
    SalesModule,
    BillingModule,
    NotificationsModule,
    ReportsModule,
    QaModule,
    AuditLogsModule,
    UploadsModule,
    CompanyProfileModule,
    PaymentsModule,
    ServiceCatalogModule,
    EmailTemplatesModule,
    ScheduleModule.forRoot(),
    SchedulerModule,
    GithubModule,
    RoadmapModule,
    AccountingModule,
    HrModule,
    HrmsModule,
    MeetingsModule,
    MailboxModule,
    ChatModule,
    OrganizationsModule,
    PlansModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: AdvancedThrottlerGuard,
    },
  ],
})
export class AppModule {}
