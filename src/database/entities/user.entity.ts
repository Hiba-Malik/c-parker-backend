import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserLevel } from './user-level.entity';
import { Payment } from './payment.entity';
import { Event } from './event.entity';

@Entity('users')
@Index(['walletAddress'], { unique: true })
@Index(['userId'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', unique: true })
  @Index()
  userId: number; // Blockchain ID

  @Column({ name: 'wallet_address', length: 42, unique: true })
  @Index()
  walletAddress: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'referrer_id' })
  referrer: User;

  @Column({ name: 'referrer_id', nullable: true })
  @Index()
  referrerId: number | null;

  @Column({ name: 'registered_at', type: 'timestamp' })
  @Index()
  registeredAt: Date;

  @Column({ name: 'registration_tx_hash', length: 66 })
  registrationTxHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => UserLevel, (level) => level.user)
  levels: UserLevel[];

  @OneToMany(() => Payment, (payment) => payment.toUser)
  paymentsReceived: Payment[];

  @OneToMany(() => Payment, (payment) => payment.fromUser)
  paymentsSent: Payment[];

  @OneToMany(() => Payment, (payment) => payment.shouldHaveGoneToUser)
  paymentsMissed: Payment[];

  @OneToMany(() => User, (user) => user.referrer)
  referrals: User[];

  @OneToMany(() => Event, (event) => event.user)
  events: Event[];
}

