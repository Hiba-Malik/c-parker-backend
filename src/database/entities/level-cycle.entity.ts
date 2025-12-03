import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { OrbitType } from './user-level.entity';

export interface CyclePosition {
  position: number;
  userId: number;
  placedAt: string; // ISO timestamp
  walletAddress?: string;
}

@Entity('level_cycles')
@Index(['userId', 'orbit', 'levelNumber'])
@Index(['orbit', 'levelNumber'])
@Index(['isActive'])
export class LevelCycle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    type: 'enum',
    enum: OrbitType,
  })
  orbit: OrbitType;

  @Column({ name: 'level_number' })
  levelNumber: number;

  @Column({ name: 'cycle_number' })
  cycleNumber: number;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'total_earnings', type: 'decimal', precision: 36, scale: 18, default: 0 })
  totalEarnings: string;

  @Column({ type: 'jsonb', default: '[]' })
  positions: CyclePosition[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'start_tx_hash' })
  startTxHash: string;

  @Column({ name: 'completion_tx_hash', nullable: true })
  completionTxHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

