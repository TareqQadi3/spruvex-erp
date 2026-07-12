import { Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import type { AccessTokenPayload } from "../../modules/identity/token.service";
import { PrismaService } from "../prisma/prisma.service";
import { rtRooms } from "./rooms";

interface SocketContext {
  userId: string;
  tenantId?: string;
  permissions: Set<string>;
}

interface SubscribePayload {
  channel: "orders" | "kitchen";
  branchId?: string;
}

/**
 * Realtime gateway (Socket.io; Redis adapter attached in main.ts when
 * REDIS_URL is configured).
 *
 * Security model:
 * - The connection must present a valid access JWT (handshake.auth.token);
 *   otherwise it is disconnected immediately.
 * - Rooms are derived from the token's tenant — never from client input.
 * - Subscriptions are permission-checked: `orders` needs orders.view,
 *   `kitchen` needs kitchen.view, and the branch must belong to the tenant
 *   (verified through the RLS-scoped client).
 */
@WebSocketGateway({
  cors: { origin: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean) },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(socket: Socket): void {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      socket.disconnect(true);
      return;
    }
    try {
      const payload = this.jwt.verify<AccessTokenPayload>(token);
      if (payload.type !== "access" || !payload.sub) {
        socket.disconnect(true);
        return;
      }
      const ctx: SocketContext = {
        userId: payload.sub,
        tenantId: payload.tenant_id,
        permissions: new Set(payload.permissions ?? []),
      };
      socket.data.ctx = ctx;
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage("subscribe")
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: SubscribePayload,
  ): Promise<{ ok: boolean; room?: string; error?: string }> {
    const ctx = socket.data.ctx as SocketContext | undefined;
    if (!ctx?.tenantId) {
      return { ok: false, error: "unauthorized" };
    }

    if (body?.channel === "orders") {
      if (!ctx.permissions.has("orders.view")) {
        return { ok: false, error: "forbidden" };
      }
      const room = rtRooms.tenantOrders(ctx.tenantId);
      await socket.join(room);
      return { ok: true, room };
    }

    if (body?.channel === "kitchen") {
      if (!ctx.permissions.has("kitchen.view")) {
        return { ok: false, error: "forbidden" };
      }
      if (!body.branchId) {
        return { ok: false, error: "branchId required" };
      }
      // Tenant check: the branch must be visible inside this tenant's RLS scope.
      const branch = await this.prisma
        .forTenant(ctx.tenantId)
        .branch.findFirst({ where: { id: body.branchId, deletedAt: null } });
      if (!branch) {
        return { ok: false, error: "branch not found" };
      }
      const room = rtRooms.branchKitchen(body.branchId);
      await socket.join(room);
      return { ok: true, room };
    }

    return { ok: false, error: "unknown channel" };
  }

  emitToRooms(rooms: string[], event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.warn("Realtime server not initialized — dropping event");
      return;
    }
    this.server.to(rooms).emit(event, payload);
  }
}
