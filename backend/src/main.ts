import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { PrismaService } from './prisma/prisma.service';
import { SeedService } from './prisma/seed.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Trust proxy (so req.ip is the real client IP behind a reverse proxy)
  const httpAdapter = app.getHttpAdapter();
  (httpAdapter.getInstance() as any).set('trust proxy', 1);

  // Security middleware
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());

  // Body parsers with sane limits for file chunk uploads
  app.use(json({ limit: '20mb' }));
  app.use(urlencoded({ extended: true, limit: '20mb' }));

  // CORS
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:5173');
  app.enableCors({
    origin: corsOrigin.split(',').map((s) => s.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With'],
  });

  // Socket.IO adapter (uses IoAdapter from @nestjs/platform-socket.io)
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger (only in non-production for security)
  if (config.get<string>('NODE_ENV') !== 'production') {
    const configBuilder = new DocumentBuilder()
      .setTitle('ChatApp API')
      .setDescription('Production-ready real-time messenger API')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, configBuilder);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Run migrations + seed initial settings on startup
  const prisma = app.get(PrismaService);
  const seed = app.get(SeedService);
  await seed.seedInitialSettings();
  await seed.ensureAdminPhoneSetting();

  // Static file serving for uploads (with strict content-disposition headers in controller)
  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Server running on http://localhost:${port}`);
  logger.log(`Swagger at http://localhost:${port}/api/docs`);
}

bootstrap();
