import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

// Modules
import { UsersModule } from './modules/users/users.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { ActivityModule } from './modules/activity/activity.module';
import { EventListenerModule } from './modules/event-listener/event-listener.module';
import { LevelCyclesModule } from './modules/level-cycles/level-cycles.module';
import { MissedPaymentsModule } from './modules/missed-payments/missed-payments.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Logging
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ level, message, context }) => {
              return `[${context}] ${level}: ${message}`;
            }),
          ),
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('DB_SYNC') === 'true',
        logging: configService.get('DB_LOGGING') === 'true',
        ssl: configService.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
      }),
    }),

    // In-Memory Cache (no Redis required)
    CacheModule.register({
      isGlobal: true,
      ttl: 300, // 5 minutes default
      max: 100, // Maximum number of items in cache
    }),

    // Scheduler for background jobs
    ScheduleModule.forRoot(),

    // Feature modules
    UsersModule,
    PaymentsModule,
    StatisticsModule,
    ActivityModule,
    EventListenerModule,
    LevelCyclesModule,
    MissedPaymentsModule,
    AnnouncementsModule,
  ],
})
export class AppModule {}

