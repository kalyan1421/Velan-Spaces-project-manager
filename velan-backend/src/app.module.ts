import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { validateEnv } from './config/env.validation';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { CamelCaseInterceptor } from './common/interceptors/camel-case.interceptor';
import { SignStorageRefsInterceptor } from './common/interceptors/sign-storage-refs.interceptor';
import { SharedModule } from './common/shared.module';
import { SupabaseModule } from './supabase/supabase.module';
import { PushModule } from './push/push.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UpdatesModule } from './modules/updates/updates.module';
import { DesignsFilesModule } from './modules/designs-files/designs-files.module';
import { RoomsTimelineModule } from './modules/rooms-timeline/rooms-timeline.module';
import { BudgetModule } from './modules/budget/budget.module';
import { SalesModule } from './modules/sales/sales.module';
import { ChatComplaintsModule } from './modules/chat-complaints/chat-complaints.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { StaffModule } from './modules/staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Global rate limit (per IP). Login/refresh get a much stricter limit.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    SharedModule,
    SupabaseModule,
    PushModule,
    AuthModule,
    StorageModule,
    HealthModule,
    ProjectsModule,
    UpdatesModule,
    DesignsFilesModule,
    RoomsTimelineModule,
    BudgetModule,
    SalesModule,
    ChatComplaintsModule,
    NotificationsModule,
    StaffModule,
  ],
  providers: [
    // Throttle first (cheap), then auth (sets req.user), then role enforcement.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // API contract is camelCase; services return raw snake_case rows.
    { provide: APP_INTERCEPTOR, useClass: CamelCaseInterceptor },
    // Rows store private-bucket refs (sb://...); responses carry signed URLs.
    { provide: APP_INTERCEPTOR, useClass: SignStorageRefsInterceptor },
  ],
})
export class AppModule {}
