import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { PermissionsGuard } from "./permissions.guard";

@Global()
@Module({
  providers: [
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class RbacModule {}
