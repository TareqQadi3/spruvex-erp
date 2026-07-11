import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

/**
 * Domain events backbone. Modules communicate via events named in
 * @spruvex-r/types DOMAIN_EVENTS (order.placed, invoice.issued, ...)
 * instead of importing each other's services.
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: ".",
    }),
  ],
})
export class EventsModule {}
