import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { validateEnv } from "./config/env.validation";
import { HealthModule } from "./health/health.module";
import { AuthContextMiddleware } from "./modules/identity/auth-context.middleware";
import { IdentityModule } from "./modules/identity/identity.module";
import { TenancyModule } from "./modules/tenancy/tenancy.module";
import { AuditModule } from "./shared/audit/audit.module";
import { EventsModule } from "./shared/events/events.module";
import { PrismaModule } from "./shared/prisma/prisma.module";
import { RbacModule } from "./shared/rbac/rbac.module";
import { TenantContextModule } from "./shared/tenancy/tenant-context.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    EventsModule,
    TenantContextModule,
    PrismaModule,
    RbacModule,
    AuditModule,
    HealthModule,
    IdentityModule,
    TenancyModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthContextMiddleware).forRoutes("*");
  }
}
