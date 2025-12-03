import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

// Suppress filter not found errors globally
const originalConsoleError = console.error;
console.error = (...args: any[]) => {
  const message = args.join(' ');
  // Suppress "filter not found" errors from ethers.js - these are harmless and expected with free RPCs
  if (message.includes('filter not found') || message.includes('could not coalesce error')) {
    return;
  }
  originalConsoleError.apply(console, args);
};

process.on('unhandledRejection', (reason: any) => {
  if (reason?.error?.message === 'filter not found' || 
      reason?.shortMessage === 'could not coalesce error') {
    // Silently ignore - this is expected behavior when RPC filters expire
    return;
  }
  // Log other unhandled rejections
  originalConsoleError('Unhandled Rejection:', reason);
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'], // Only show errors and warnings during startup
  });

  // Get config service
  const configService = app.get(ConfigService);
  
  // Use Winston logger for application logs
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Global prefix
  const apiPrefix = configService.get('API_PREFIX') || 'api/v1';
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
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Length', 'X-Total-Count'],
    maxAge: 3600,
  });

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('C-Parker Platform API')
    .setDescription('API for C-Parker Orbit Matrix Platform')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('users', 'User management and profiles')
    .addTag('levels', 'Level progression and matrix')
    .addTag('payments', 'Payment history and analytics')
    .addTag('statistics', 'Platform and user statistics')
    .addTag('activity', 'Activity feed and events')
    .addTag('announcements', 'Admin announcements management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Start server
  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`
    ========================================
    C-Parker API Server Started
    ========================================
    Server: http://localhost:${port}
    Docs: http://localhost:${port}/docs
    API: http://localhost:${port}/${apiPrefix}
    ========================================
  `);
}

bootstrap();

