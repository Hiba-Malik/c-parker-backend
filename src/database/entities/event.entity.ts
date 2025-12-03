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

@Entity('events')
@Index(['transactionHash', 'logIndex'], { unique: true })
export class Event {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'event_name', length: 100 })
  @Index()
  eventName: string;

  @Column({ length: 10 })
  @Index()
  contract: string; // 'OrbitA' or 'OrbitB'

  @ManyToOne(() => User, (user) => user.events, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', nullable: true })
  @Index()
  userId: number;

  @Column({ name: 'referrer_id', nullable: true })
  referrerId: number;

  @Column({ name: 'level_number', nullable: true })
  levelNumber: number;

  @Column({ name: 'event_data', type: 'jsonb' })
  eventData: any;

  @Column({ name: 'transaction_hash', length: 66 })
  @Index()
  transactionHash: string;

  @Column({ name: 'block_number', type: 'bigint' })
  blockNumber: string;

  @Column({ name: 'block_timestamp', type: 'timestamp' })
  @Index()
  blockTimestamp: Date;

  @Column({ name: 'log_index' })
  logIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

