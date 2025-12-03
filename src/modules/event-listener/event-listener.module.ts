import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { User, UserLevel, Payment, Event } from '../../database/entities';
import { MissedPayment } from '../../database/entities/missed-payment.entity';
import { EventListenerService } from './services/event-listener.service';
import { BlockchainService } from './services/blockchain.service';
import { OrbitAProcessor } from './processors/orbit-a.processor';
import { OrbitBProcessor } from './processors/orbit-b.processor';
import { EventListenerController } from './event-listener.controller';
import { LevelCyclesModule } from '../level-cycles/level-cycles.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, UserLevel, Payment, Event, MissedPayment]),
    LevelCyclesModule,
  ],
  controllers: [EventListenerController],
  providers: [
    BlockchainService,
    EventListenerService,
    OrbitAProcessor,
    OrbitBProcessor,
  ],
  exports: [EventListenerService, BlockchainService],
})
export class EventListenerModule {}

