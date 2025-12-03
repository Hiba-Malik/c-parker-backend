import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { Payment, User, UserLevel } from '../../database/entities';
import { UsersService } from '../users/users.service';
import { EventListenerModule } from '../event-listener/event-listener.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, UserLevel]),
    forwardRef(() => EventListenerModule),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, UsersService],
  exports: [PaymentsService],
})
export class PaymentsModule {}


