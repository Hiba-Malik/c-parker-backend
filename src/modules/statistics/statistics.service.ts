import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User, Payment } from '../../database/entities';
import { PlatformStatsDto, LeaderboardEntryDto, RecentUsersDto } from './dto/statistics-response.dto';
import { weiToEther } from '../../utils/wei-to-ether.util';

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getPlatformStats(): Promise<PlatformStatsDto> {
    // Check cache
    const cacheKey = 'platform:stats';
    const cached = await this.cacheManager.get<PlatformStatsDto>(cacheKey);
    if (cached) return cached;

    // Query from database view
    const result = await this.userRepository.query(
      'SELECT * FROM platform_stats LIMIT 1',
    );

    const stats: PlatformStatsDto = {
      totalUsers: parseInt(result[0]?.total_users) || 0,
      totalUsersOrbitA: parseInt(result[0]?.total_users_orbit_a) || 0,
      totalUsersOrbitB: parseInt(result[0]?.total_users_orbit_b) || 0,
      newUsersToday: parseInt(result[0]?.new_users_today) || 0,
      totalCctEarned: weiToEther(result[0]?.total_cct_earned) || '0',
      totalTransactions: parseInt(result[0]?.total_transactions) || 0,
      totalTurnover: weiToEther(result[0]?.total_turnover) || '0',
    };

    // Cache for 5 minutes
    await this.cacheManager.set(cacheKey, stats, 300);

    return stats;
  }

  async getLeaderboard(limit: number = 100): Promise<LeaderboardEntryDto[]> {
    // Check cache
    const cacheKey = `leaderboard:top${limit}`;
    const cached = await this.cacheManager.get<LeaderboardEntryDto[]>(cacheKey);
    if (cached) return cached;

    // Query leaderboard
    const result = await this.userRepository.query(
      `
      SELECT 
        u.id,
        u.user_id,
        u.wallet_address,
        COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN CAST(p.amount AS DECIMAL) ELSE 0 END), 0) as total_earned,
        COUNT(DISTINCT ref.id) as total_partners,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN CAST(p.amount AS DECIMAL) ELSE 0 END), 0) DESC) as rank
      FROM users u
      LEFT JOIN payments p ON p.to_user_id = u.id
      LEFT JOIN users ref ON ref.referrer_id = u.id
      GROUP BY u.id
      ORDER BY total_earned DESC
      LIMIT $1
      `,
      [limit],
    );

    const leaderboard: LeaderboardEntryDto[] = await Promise.all(
      result.map(async (row) => {
        const teamSizeResult = await this.userRepository.query(
          'SELECT get_team_size($1) as team_size',
          [row.id],
        );

        return {
          rank: parseInt(row.rank),
          userId: row.user_id,
          walletAddress: row.wallet_address,
          totalEarned: weiToEther(row.total_earned.toString()) || '0',
          totalPartners: parseInt(row.total_partners) || 0,
          totalTeamSize: parseInt(teamSizeResult[0].team_size) || 0,
        };
      }),
    );

    // Cache for 10 minutes
    await this.cacheManager.set(cacheKey, leaderboard, 600);

    return leaderboard;
  }

  async getRecentUsers(hours: number = 24): Promise<RecentUsersDto[]> {
    const sinceTime = new Date();
    sinceTime.setHours(sinceTime.getHours() - hours);

    const users = await this.userRepository
      .createQueryBuilder('user')
      .leftJoin('user.referrer', 'referrer')
      .select([
        'user.userId as user_id',
        'user.walletAddress as wallet_address',
        'referrer.userId as referrer_user_id',
        'user.registeredAt as registered_at',
      ])
      .where('user.registeredAt >= :sinceTime', { sinceTime })
      .orderBy('user.registeredAt', 'DESC')
      .limit(100)
      .getRawMany();

    return users.map((user) => {
      const hoursAgo = Math.floor(
        (Date.now() - new Date(user.registered_at).getTime()) / (1000 * 60 * 60),
      );

      return {
        userId: user.user_id,
        walletAddress: user.wallet_address,
        referrerUserId: user.referrer_user_id, // Blockchain user ID of referrer
        registeredAt: user.registered_at,
        hoursAgo,
      };
    });
  }
}



