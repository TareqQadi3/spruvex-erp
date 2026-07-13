import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { RedisIoAdapter } from "./shared/realtime/redis-io.adapter";
import { AllExceptionsFilter } from "./shared/errors/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const ioAdapter = new RedisIoAdapter(app);
  await ioAdapter.connectToRedis();
  app.useWebSocketAdapter(ioAdapter);

  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? "").split(",").filter(Boolean),
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}

void bootstrap();
