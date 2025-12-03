import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserLevel, Payment } from '../../database/entities';
import { EventListenerModule } from '../event-listener/event-listener.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserLevel, Payment]),
    forwardRef(() => EventListenerModule),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}


