import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LevelCycle } from '../../database/entities/level-cycle.entity';
import { User } from '../../database/entities/user.entity';
import { LevelCyclesService } from './level-cycles.service';
import { LevelCyclesController } from './level-cycles.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LevelCycle, User]),
    forwardRef(() => UsersModule),
  ],
  controllers: [LevelCyclesController],
  providers: [LevelCyclesService],
  exports: [LevelCyclesService],
})
export class LevelCyclesModule {}

