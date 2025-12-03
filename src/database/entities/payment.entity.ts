import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { OrbitType } from './user-level.entity';

export enum PaymentStatus {
  RECEIVED = 'RECEIVED',
  MISSED = 'MISSED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.paymentsSent, { nullable: true })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User;

  @Column({ name: 'from_user_id', nullable: true })
  @Index()
  fromUserId: number;

  @ManyToOne(() => User, (user) => user.paymentsReceived)
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  @Column({ name: 'to_user_id' })
  @Index()
  toUserId: number;

  @Column({
    type: 'enum',
    enum: OrbitType,
  })
  @Index()
  orbit: OrbitType;

  @Column({ name: 'level_number' })
  levelNumber: number;

  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
  })
  @Index()
  status: PaymentStatus;

  @Column({ name: 'payment_type', length: 50, nullable: true })
  paymentType: string;

  @ManyToOne(() => User, (user) => user.paymentsMissed, { nullable: true })
  @JoinColumn({ name: 'should_have_gone_to_user_id' })
  shouldHaveGoneToUser: User;

  @Column({ name: 'should_have_gone_to_user_id', nullable: true })
  @Index()
  shouldHaveGoneToUserId: number;

  @Column({ name: 'transaction_hash', length: 66 })
  @Index()
  transactionHash: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber: string;

  @Column({ name: 'block_timestamp', type: 'timestamp' })
  @Index()
  blockTimestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

