import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port);
  app.getHttpServer().keepAliveTimeout = 65_000;
}

bootstrap();
