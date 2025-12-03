import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { User, UserLevel, Payment } from '../../database/entities';
import { UserResponseDto, UserStatsDto, UserTeamMemberDto } from './dto/user-response.dto';
import { weiToEther } from '../../utils/wei-to-ether.util';
import { BlockchainService } from '../event-listener/services/blockchain.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserLevel)
    private userLevelRepository: Repository<UserLevel>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    private blockchainService: BlockchainService,
  ) {}

  /**
   * Helper to convert user entity to response DTO with blockchain user IDs
   */
  private async toResponseDto(user: User): Promise<UserResponseDto> {
    // Get referrer's blockchain user ID if referrer exists
    let referrerBlockchainId = null;
    if (user.referrerId) {
      const referrer = await this.userRepository.findOne({
        where: { id: user.referrerId },
        select: ['userId'],
      });
      referrerBlockchainId = referrer?.userId || null;
    }

    return {
      id: user.id,
      userId: user.userId,
      walletAddress: user.walletAddress,
      referrerId: referrerBlockchainId, // Blockchain user ID of referrer
      registeredAt: user.registeredAt,
      registrationTxHash: user.registrationTxHash,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async findOne(id: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.toResponseDto(user);
  }

  async findByUserId(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { userId },
    });

    if (!user) {
      throw new NotFoundException(`User with blockchain ID ${userId} not found`);
    }

    return this.toResponseDto(user);
  }

  async findByWallet(walletAddress: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { walletAddress: walletAddress.toLowerCase() },
    });

    if (!user) {
      throw new NotFoundException(`User with wallet ${walletAddress} not found`);
    }

    return this.toResponseDto(user);
  }

  async getStats(id: number): Promise<UserStatsDto> {
    // Check cache
    const cacheKey = `user:stats:${id}`;
    const cached = await this.cacheManager.get<UserStatsDto>(cacheKey);
    if (cached) return cached;

    // Query from database view
    const result = await this.userRepository.query(
      'SELECT * FROM user_stats WHERE id = $1',
      [id],
    );

    if (!result || result.length === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Calculate total spent (registration + all level purchases)
    const spentResult = await this.userRepository.query(
      `
      SELECT 
        COALESCE(SUM(CAST((event_data->>'cctAmount') AS DECIMAL)), 0) as total_spent
      FROM events
      WHERE user_id = $1
        AND event_name IN ('UserRegistered', 'LevelPurchased')
      `,
      [id],
    );
    const totalSpent = weiToEther(spentResult[0].total_spent) || '0';
    const totalEarned = weiToEther(result[0].total_earned) || '0';

    // Calculate ratio (earned / spent)
    const spentNum = parseFloat(totalSpent);
    const earnedNum = parseFloat(totalEarned);
    const ratio = spentNum > 0 ? (earnedNum / spentNum).toFixed(2) : '0.00';

    // Get total partners and team size
    const totalPartners = parseInt(result[0].total_partners) || 0;
    const teamSizeResult = await this.userRepository.query(
      'SELECT get_team_size($1) as team_size',
      [id],
    );
    const totalTeamSize = parseInt(teamSizeResult[0].team_size) || 0;

    // Calculate 24-hour changes
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Partners in last 24h
    const partnersLast24hResult = await this.userRepository.query(
      'SELECT COUNT(*) as count FROM users WHERE referrer_id = $1 AND registered_at >= $2',
      [id, yesterday],
    );
    const partnersLast24h = parseInt(partnersLast24hResult[0].count) || 0;

    // Team members in last 24h (recursive)
    const teamLast24hResult = await this.userRepository.query(
      `
      WITH RECURSIVE team AS (
        SELECT id FROM users WHERE referrer_id = $1
        UNION ALL
        SELECT u.id FROM users u
        INNER JOIN team t ON u.referrer_id = t.id
        WHERE u.registered_at >= $2
      )
      SELECT COUNT(*) as count FROM team t
      JOIN users u ON u.id = t.id
      WHERE u.registered_at >= $2
      `,
      [id, yesterday],
    );
    const teamLast24h = parseInt(teamLast24hResult[0].count) || 0;

    // Calculate ratio 24h ago
    const earned24hAgoResult = await this.userRepository.query(
      `
      SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as earned
      FROM payments
      WHERE to_user_id = $1
        AND status = 'RECEIVED'
        AND block_timestamp < $2
      `,
      [id, yesterday],
    );
    const earned24hAgo = parseFloat(weiToEther(earned24hAgoResult[0].earned) || '0');
    const ratio24hAgo = spentNum > 0 ? (earned24hAgo / spentNum) : 0;
    const ratioLast24h = (parseFloat(ratio) - ratio24hAgo).toFixed(2);

    const stats: UserStatsDto = {
      totalPartners,
      partnersLast24h,
      totalTeamSize,
      teamLast24h,
      totalEarned,
      totalSpent,
      ratio,
      ratioLast24h,
      totalMissed: weiToEther(result[0].total_missed) || '0',
      orbitALevels: parseInt(result[0].orbit_a_levels) || 0,
      orbitBLevels: parseInt(result[0].orbit_b_levels) || 0,
      orbitAEarned: weiToEther(result[0].orbit_a_earned) || '0',
      orbitBEarned: weiToEther(result[0].orbit_b_earned) || '0',
      lastActivityAt: result[0].last_activity_at,
    };

    // Cache for 60 seconds
    await this.cacheManager.set(cacheKey, stats, 60);

    return stats;
  }

  async getReferrals(id: number): Promise<UserResponseDto[]> {
    // Direct referrals only
    const referrals = await this.userRepository.find({
      where: { referrerId: id },
      order: { registeredAt: 'DESC' },
    });

    // Convert all referrals to response DTOs with blockchain user IDs
    return Promise.all(referrals.map((user) => this.toResponseDto(user)));
  }

  async getTeam(id: number): Promise<UserTeamMemberDto[]> {
    // Recursive team members
    const result = await this.userRepository.query(
      `
      WITH RECURSIVE team AS (
        SELECT id, user_id, wallet_address, registered_at, referrer_id, 1 as level
        FROM users
        WHERE referrer_id = $1
        
        UNION ALL
        
        SELECT u.id, u.user_id, u.wallet_address, u.registered_at, u.referrer_id, t.level + 1
        FROM users u
        INNER JOIN team t ON u.referrer_id = t.id
        WHERE t.level < 100
      )
      SELECT * FROM team
      ORDER BY level, registered_at
      `,
      [id],
    );

    return result.map((row) => ({
      userId: row.user_id, // Blockchain user ID
      walletAddress: row.wallet_address,
      registeredAt: row.registered_at,
      level: row.level,
    }));
  }

  async getLevels(id: number, orbit?: string) {
    const where: any = { userId: id };
    if (orbit) {
      where.orbit = orbit.toUpperCase();
    }

    const levels = await this.userLevelRepository.find({
      where,
      order: { levelNumber: 'ASC' },
    });

    // Enrich each level with pricing information
    const enrichedLevels = await Promise.all(
      levels.map(async (level) => {
        try {
          const orbitType = level.orbit as 'ORBIT_A' | 'ORBIT_B';
          
          // Get prices from blockchain/contract
          const [priceInUSD, cctAmount, cctPrice] = await Promise.all([
            this.blockchainService.getLevelPriceInUSD(level.levelNumber, orbitType),
            this.blockchainService.getRequiredCCTForLevel(level.levelNumber, orbitType),
            this.blockchainService.getCurrentCCTPrice(),
          ]);

          return {
            ...level,
            pricing: {
              usdPrice: priceInUSD,
              cctAmount: cctAmount,
              cctPriceInUSD: cctPrice,
            },
          };
        } catch (error) {
          // If pricing fetch fails, return level without pricing
          return {
            ...level,
            pricing: {
              usdPrice: '0',
              cctAmount: '0',
              cctPriceInUSD: '0',
            },
          };
        }
      }),
    );

    return enrichedLevels;
  }

  async getMatrixDownlines(id: number, orbit: string, level: number) {
    const result = await this.userRepository.query(
      'SELECT * FROM get_matrix_downlines($1, $2, $3)',
      [id, orbit.toUpperCase(), level],
    );

    return result;
  }

  /**
   * Get pricing for all levels (1-10) for both Orbit A and Orbit B
   */
  async getAllLevelsPricing() {
    try {
      // Get current CCT price once
      const cctPriceInUSD = await this.blockchainService.getCurrentCCTPrice();

      // Generate pricing for all levels (1-10) for both orbits
      const orbitA = await Promise.all(
        Array.from({ length: 10 }, (_, i) => i + 1).map(async (level) => {
          try {
            const [usdPrice, cctAmount] = await Promise.all([
              this.blockchainService.getLevelPriceInUSD(level, 'ORBIT_A'),
              this.blockchainService.getRequiredCCTForLevel(level, 'ORBIT_A'),
            ]);

            return {
              level,
              usdPrice,
              cctAmount,
            };
          } catch (error) {
            // Fallback if blockchain call fails
            return {
              level,
              usdPrice: '0',
              cctAmount: '0',
            };
          }
        }),
      );

      const orbitB = await Promise.all(
        Array.from({ length: 10 }, (_, i) => i + 1).map(async (level) => {
          try {
            const [usdPrice, cctAmount] = await Promise.all([
              this.blockchainService.getLevelPriceInUSD(level, 'ORBIT_B'),
              this.blockchainService.getRequiredCCTForLevel(level, 'ORBIT_B'),
            ]);

            return {
              level,
              usdPrice,
              cctAmount,
            };
          } catch (error) {
            // Fallback if blockchain call fails
            return {
              level,
              usdPrice: '0',
              cctAmount: '0',
            };
          }
        }),
      );

      return {
        cctPriceInUSD,
        orbitA,
        orbitB,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Complete fallback if everything fails
      return {
        cctPriceInUSD: '0.50',
        orbitA: Array.from({ length: 10 }, (_, i) => ({
          level: i + 1,
          usdPrice: '0',
          cctAmount: '0',
        })),
        orbitB: Array.from({ length: 10 }, (_, i) => ({
          level: i + 1,
          usdPrice: '0',
          cctAmount: '0',
        })),
        timestamp: new Date().toISOString(),
      };
    }
  }
}



