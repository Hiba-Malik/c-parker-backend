import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Payment } from '../../database/entities';
import { PaymentResponseDto, LevelEarningsDto } from './dto/payment-response.dto';
import { weiToEther } from '../../utils/wei-to-ether.util';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async findAllByUser(
    userId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: [{ toUserId: userId }, { fromUserId: userId }],
      order: { blockTimestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return payments.map((payment) => ({
      ...payment,
      amount: weiToEther(payment.amount) || '0',
    }));
  }

  async findReceivedPayments(
    userId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: { toUserId: userId, status: 'RECEIVED' as any },
      order: { blockTimestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return payments.map((payment) => ({
      ...payment,
      amount: weiToEther(payment.amount) || '0',
    }));
  }

  async findMissedPayments(
    userId: number,
    limit: number = 50,
    offset: number = 0,
  ): Promise<PaymentResponseDto[]> {
    const payments = await this.paymentRepository.find({
      where: { shouldHaveGoneToUserId: userId, status: 'MISSED' as any },
      order: { blockTimestamp: 'DESC' },
      take: limit,
      skip: offset,
    });

    return payments.map((payment) => ({
      ...payment,
      amount: weiToEther(payment.amount) || '0',
    }));
  }

  async getEarningsByLevel(userId: number): Promise<LevelEarningsDto[]> {
    // Check cache
    const cacheKey = `user:earnings:${userId}`;
    const cached = await this.cacheManager.get<LevelEarningsDto[]>(cacheKey);
    if (cached) return cached;

    // Query that includes both activated levels AND levels with missed opportunities
    const result = await this.paymentRepository.query(
      `
      WITH all_levels AS (
        -- Get activated levels from user_levels
        SELECT 
          ul.user_id,
          ul.orbit,
          ul.level_number,
          ul.recycle_count,
          ul.is_active
        FROM user_levels ul
        WHERE ul.user_id = $1
        
        UNION
        
        -- Get levels where user has missed payments (even if not activated)
        SELECT DISTINCT
          p.should_have_gone_to_user_id as user_id,
          p.orbit,
          p.level_number,
          0 as recycle_count,
          false as is_active
        FROM payments p
        WHERE p.should_have_gone_to_user_id = $1
          AND p.status = 'MISSED'
          AND NOT EXISTS (
            SELECT 1 FROM user_levels ul2 
            WHERE ul2.user_id = $1 
              AND ul2.orbit = p.orbit 
              AND ul2.level_number = p.level_number
          )
        
        UNION
        
        -- Get levels where user has MissedPayment events (even with no amount)
        SELECT DISTINCT
          u.id as user_id,
          CASE 
            WHEN e.contract = 'OrbitA' THEN 'ORBIT_A'::orbit_type
            WHEN e.contract = 'OrbitB' THEN 'ORBIT_B'::orbit_type
          END as orbit,
          (e.event_data->>'level')::int as level_number,
          0 as recycle_count,
          false as is_active
        FROM events e
        JOIN users u ON u.user_id = (e.event_data->>'missedByUserID')::int
        WHERE u.id = $1
          AND e.event_name = 'MissedPayment'
          AND NOT EXISTS (
            SELECT 1 FROM user_levels ul3 
            WHERE ul3.user_id = $1 
              AND ul3.orbit = CASE 
                WHEN e.contract = 'OrbitA' THEN 'ORBIT_A'::orbit_type
                WHEN e.contract = 'OrbitB' THEN 'ORBIT_B'::orbit_type
              END
              AND ul3.level_number = (e.event_data->>'level')::int
          )
      )
      SELECT 
        al.user_id,
        al.orbit,
        al.level_number,
        al.recycle_count,
        al.is_active,
        
        -- Earned at this level
        COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN p.amount ELSE 0 END), 0) as earned,
        
        -- Missed at this level (actual payment amounts that were redirected)
        COALESCE(SUM(CASE WHEN p.status = 'MISSED' THEN p.amount ELSE 0 END), 0) as missed,
        
        -- Payment counts
        COUNT(CASE WHEN p.status = 'RECEIVED' THEN 1 END) as payment_count,
        
        -- Missed count includes both payments AND MissedPayment events
        (COUNT(CASE WHEN p.status = 'MISSED' THEN 1 END) + 
         COALESCE((SELECT COUNT(*) FROM events e 
                   JOIN users u2 ON u2.user_id = (e.event_data->>'missedByUserID')::int
                   WHERE e.event_name = 'MissedPayment'
                     AND u2.id = al.user_id
                     AND CASE 
                       WHEN e.contract = 'OrbitA' THEN 'ORBIT_A'::orbit_type
                       WHEN e.contract = 'OrbitB' THEN 'ORBIT_B'::orbit_type
                     END = al.orbit
                     AND (e.event_data->>'level')::int = al.level_number), 0)) as missed_count
        
      FROM all_levels al
      LEFT JOIN payments p ON 
        p.level_number = al.level_number 
        AND p.orbit = al.orbit
        AND (p.to_user_id = al.user_id OR p.should_have_gone_to_user_id = al.user_id)
      GROUP BY al.user_id, al.orbit, al.level_number, al.recycle_count, al.is_active
      ORDER BY al.orbit, al.level_number
      `,
      [userId],
    );

    const earnings: LevelEarningsDto[] = result.map((row) => ({
      levelNumber: row.level_number,
      orbit: row.orbit,
      earned: weiToEther(row.earned) || '0',
      missed: weiToEther(row.missed) || '0',
      recycleCount: parseInt(row.recycle_count) || 0,
      paymentCount: parseInt(row.payment_count) || 0,
      missedCount: parseInt(row.missed_count) || 0,
    }));

    // Cache for 60 seconds
    await this.cacheManager.set(cacheKey, earnings, 60);

    return earnings;
  }

  async getTotalEarnings(userId: number) {
    // Total earnings (profit)
    const totalResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(CAST(payment.amount AS DECIMAL))', 'total')
      .where('payment.toUserId = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'RECEIVED' })
      .getRawOne();

    // Passive income: earnings from users who were NOT directly referred by this user
    // This means fromUser.referrerId != userId (internal id)
    const passiveIncomeResult = await this.paymentRepository.query(
      `
      SELECT SUM(CAST(p.amount AS DECIMAL)) as passive_income
      FROM payments p
      LEFT JOIN users paying_user ON paying_user.id = p.from_user_id
      WHERE p.to_user_id = $1
        AND p.status = 'RECEIVED'
        AND (paying_user.referrer_id != $1 OR paying_user.referrer_id IS NULL OR p.from_user_id IS NULL)
      `,
      [userId],
    );

    // Orbit A earnings
    const orbitAResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(CAST(payment.amount AS DECIMAL))', 'total')
      .where('payment.toUserId = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'RECEIVED' })
      .andWhere('payment.orbit = :orbit', { orbit: 'ORBIT_A' })
      .getRawOne();

    // Orbit B earnings
    const orbitBResult = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(CAST(payment.amount AS DECIMAL))', 'total')
      .where('payment.toUserId = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'RECEIVED' })
      .andWhere('payment.orbit = :orbit', { orbit: 'ORBIT_B' })
      .getRawOne();

    return {
      profit: weiToEther(totalResult.total) || '0',
      passiveIncome: weiToEther(passiveIncomeResult[0]?.passive_income) || '0',
      orbitAEarnings: weiToEther(orbitAResult.total) || '0',
      orbitBEarnings: weiToEther(orbitBResult.total) || '0',
      // Keep 'total' for backwards compatibility
      total: weiToEther(totalResult.total) || '0',
    };
  }

  async getTotalMissed(userId: number) {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('SUM(CAST(payment.amount AS DECIMAL))', 'total')
      .where('payment.shouldHaveGoneToUserId = :userId', { userId })
      .andWhere('payment.status = :status', { status: 'MISSED' })
      .getRawOne();

    return {
      total: weiToEther(result.total) || '0',
    };
  }
}



