import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissedPayment } from '../../database/entities/missed-payment.entity';
import { User } from '../../database/entities';
import { MissedPaymentsController } from './missed-payments.controller';
import { MissedPaymentsService } from './missed-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MissedPayment, User]),
  ],
  controllers: [MissedPaymentsController],
  providers: [MissedPaymentsService],
  exports: [MissedPaymentsService],
})
export class MissedPaymentsModule {}







