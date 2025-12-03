import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { User, UserLevel, Payment, Event } from '../../database/entities';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserLevel, Payment, Event])],
  controllers: [StatisticsController],
  providers: [StatisticsService],
  exports: [StatisticsService],
})
export class StatisticsModule {}



