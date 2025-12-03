import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum OrbitType {
  ORBIT_A = 'ORBIT_A',
  ORBIT_B = 'ORBIT_B',
}

@Entity('user_levels')
@Index(['userId', 'orbit', 'levelNumber'], { unique: true })
export class UserLevel {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, (user) => user.levels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @Column({
    type: 'enum',
    enum: OrbitType,
  })
  @Index()
  orbit: OrbitType;

  @Column({ name: 'level_number' })
  levelNumber: number;

  @Column({ name: 'is_active', default: false })
  @Index()
  isActive: boolean;

  @Column({ name: 'activated_at', type: 'timestamp', nullable: true })
  activatedAt: Date;

  @Column({ name: 'activation_tx_hash', length: 66, nullable: true })
  activationTxHash: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'upline_id' })
  upline: User;

  @Column({ name: 'upline_id', nullable: true })
  @Index()
  uplineId: number;

  @Column({ name: 'position_in_upline', nullable: true })
  positionInUpline: number; // 1-4 (Orbit A) or 1-6 (Orbit B)

  @Column({ name: 'recycle_count', default: 0 })
  recycleCount: number;

  @Column({ name: 'last_recycled_at', type: 'timestamp', nullable: true })
  lastRecycledAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

