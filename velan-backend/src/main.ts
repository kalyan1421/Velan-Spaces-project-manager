import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { Env } from './config/env.validation';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);
  const isProd = config.get('NODE_ENV', { infer: true }) === 'production';

  const prefix = config.get('API_PREFIX', { infer: true });
  app.setGlobalPrefix(prefix);

  // Behind a reverse proxy (Render/Railway) the client IP comes from
  // X-Forwarded-For; without this every user shares the proxy's IP and the
  // rate limiter would throttle everyone together.
  const hops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (hops > 0) app.set('trust proxy', hops);

  app.use(helmet());

  // CORS: native mobile apps ignore it; only the Flutter *web* build needs it.
  const origins = (config.get('CORS_ORIGINS', { infer: true }) ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: false });
  } else if (!isProd) {
    app.enableCors(); // permissive only for local development
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const swaggerFlag = config.get('ENABLE_SWAGGER', { infer: true });
  const swaggerOn = swaggerFlag ? swaggerFlag === 'true' : !isProd;
  if (swaggerOn) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Velan Spaces API')
      .setDescription('Backend API for the Velan Spaces app (Supabase/PostgreSQL)')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  }

  const port = config.get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(
    `Velan backend on :${port}/${prefix} (docs ${swaggerOn ? 'enabled at /docs' : 'disabled'})`,
  );
}

void bootstrap();
