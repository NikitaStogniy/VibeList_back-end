import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Initialize Sentry if configured
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        nodeProfilingIntegration(),
      ],
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    logger.log('Sentry initialized');
  }

  // Global prefix
  const apiPrefix = process.env.API_PREFIX || 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:3000',
    'http://localhost:19000',
  ];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  logger.log(`CORS enabled for origins: ${corsOrigins.join(', ')}`);

  // Swagger documentation
  if (process.env.ENABLE_SWAGGER !== 'false') {
    const config = new DocumentBuilder()
      .setTitle('VibeList API')
      .setDescription('Social Wishlist Application - Monolithic Backend API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management and profiles')
      .addTag('wishlist', 'Wishlist items and reservations')
      .addTag('feed', 'Social feed from followed users')
      .addTag('notifications', 'Push and email notifications')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    const swaggerPath = process.env.SWAGGER_PATH || 'api/docs';
    SwaggerModule.setup(swaggerPath, app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });

    logger.log(`Swagger documentation available at: /${swaggerPath}`);
  }

  // Start server
  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Use APP_URL from env or construct from localhost for development
  const appUrl = process.env.APP_URL || `http://localhost:${port}`;
  const baseUrl = appUrl.replace(/\/$/, ''); // Remove trailing slash if present

  logger.log(`🚀 Application is running on: ${baseUrl}`);
  logger.log(`📚 API documentation: ${baseUrl}/${process.env.SWAGGER_PATH || 'api/docs'}`);
  logger.log(`🔥 API endpoints: ${baseUrl}/${apiPrefix}`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
