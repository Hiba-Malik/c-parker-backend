import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { OrbitType } from './user-level.entity';

export enum MissedPaymentReason {
  LEVEL_NOT_ACTIVATED = 'LEVEL_NOT_ACTIVATED',
  BYPASSED_IN_CASCADE = 'BYPASSED_IN_CASCADE',
  ADMIN_FALLBACK = 'ADMIN_FALLBACK',
}

@Entity('missed_payments')
@Index(['missedByUserId'])
@Index(['receivedByUserId'])
@Index(['triggeredByUserId'])
@Index(['orbit', 'levelNumber'])
@Index(['blockTimestamp'])
@Index(['transactionHash'])
export class MissedPayment {
  @PrimaryGeneratedColumn()
  id: number;

  // Who missed the payment
  @Column({ name: 'missed_by_user_id' })
  missedByUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'missed_by_user_id' })
  missedByUser: User;

  // Who actually received it
  @Column({ name: 'received_by_user_id', nullable: true })
  receivedByUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'received_by_user_id' })
  receivedByUser: User | null;

  // Who triggered this payment (bought the level)
  @Column({ name: 'triggered_by_user_id', nullable: true })
  triggeredByUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'triggered_by_user_id' })
  triggeredByUser: User | null;

  // Level details
  @Column({
    type: 'enum',
    enum: OrbitType,
  })
  orbit: OrbitType;

  @Column({ name: 'level_number' })
  levelNumber: number;

  // Payment amount (stored as string to handle DECIMAL(36,18))
  @Column({ type: 'decimal', precision: 36, scale: 18 })
  amount: string;

  // Why was it missed?
  @Column({
    type: 'enum',
    enum: MissedPaymentReason,
  })
  reason: MissedPaymentReason;

  // Cascade depth
  @Column({ name: 'cascade_depth', default: 0 })
  cascadeDepth: number;

  // Blockchain data
  @Column({ name: 'transaction_hash', length: 66 })
  transactionHash: string;

  @Column({ name: 'block_number', length: 20 })
  blockNumber: string;

  @Column({ name: 'block_timestamp', type: 'timestamp' })
  blockTimestamp: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

