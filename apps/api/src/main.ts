import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

const isProd = () => {
  const env = process.env.NODE_ENV || process.env.APP_ENV || '';
  return env.toLowerCase() === 'production';
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );
  app.use(cookieParser());

  const defaultWebPort = Number(process.env.WEB_PORT || 3001);
  const fallbackOrigin = `http://localhost:${defaultWebPort}`;
  const corsOriginRaw = process.env.CORS_ORIGIN || process.env.WEB_ORIGIN || fallbackOrigin;
  const corsOrigins = corsOriginRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  let originSetting: true | string[] = corsOrigins;
  if (corsOrigins.length === 1 && corsOrigins[0] === '*') {
    if (isProd()) {
      throw new Error(
        'CORS_ORIGIN="*" is not allowed in production when credentials are enabled.',
      );
    }
    originSetting = [fallbackOrigin];
    console.warn(
      `[security] CORS_ORIGIN="*" is unsafe with credentials; using fallback origin ${fallbackOrigin} in development.`,
    );
  }
  app.enableCors({
    origin: originSetting,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = Number(process.env.API_PORT || 3000);
  await app.listen(port);
  app.getHttpServer().keepAliveTimeout = 65_000;
}

bootstrap();
