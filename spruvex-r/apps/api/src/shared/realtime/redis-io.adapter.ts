import { Logger } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient } from "redis";
import type { ServerOptions } from "socket.io";

/**
 * Socket.io adapter with optional Redis pub/sub backing (multi-instance
 * fan-out). When REDIS_URL is unset or unreachable the server runs with the
 * default in-memory adapter — fine for a single instance and for tests.
 */
export class RedisIoAdapter extends IoAdapter {
  private readonly logger = new Logger(RedisIoAdapter.name);
  private adapterConstructor?: ReturnType<typeof createAdapter>;

  async connectToRedis(): Promise<void> {
    const url = process.env.REDIS_URL;
    if (!url) {
      this.logger.log("REDIS_URL not set — realtime uses the in-memory adapter");
      return;
    }
    try {
      const pubClient = createClient({ url });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient);
      this.logger.log("Realtime Redis adapter connected");
    } catch (error) {
      this.logger.warn(
        `Redis unavailable (${(error as Error).message}) — falling back to in-memory adapter`,
      );
    }
  }

  override createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }
}
