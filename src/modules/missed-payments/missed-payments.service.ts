import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MissedPayment } from '../../database/entities/missed-payment.entity';
import { User } from '../../database/entities';
import { 
  MissedPaymentDetailDto, 
  UserMissedPaymentsSummaryDto,
  MissedPaymentsByLevelDto 
} from './dto/missed-payment-response.dto';

@Injectable()
export class MissedPaymentsService {
  constructor(
    @InjectRepository(MissedPayment)
    private missedPaymentRepository: Repository<MissedPayment>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  /**
   * Convert wei amount to ether string
   */
  private weiToEther(wei: string): string {
    if (!wei || wei === '0') return '0';
    const bigIntWei = BigInt(wei);
    const divisor = BigInt('1000000000000000000'); // 10^18
    const wholePart = bigIntWei / divisor;
    const remainder = bigIntWei % divisor;
    const remainderStr = remainder.toString().padStart(18, '0');
    
    // Remove trailing zeros
    const trimmedRemainder = remainderStr.replace(/0+$/, '');
    
    if (trimmedRemainder.length === 0) {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedRemainder}`;
  }

  /**
   * Get all missed payments for a user with full details
   */
  async getUserMissedPayments(blockchainUserId: number): Promise<UserMissedPaymentsSummaryDto> {
    // Find user by blockchain ID
    const user = await this.userRepository.findOne({ 
      where: { userId: blockchainUserId } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${blockchainUserId} not found`);
    }

    // Get all missed payments with relations
    const missedPayments = await this.missedPaymentRepository.find({
      where: { missedByUserId: user.id },
      relations: ['triggeredByUser', 'receivedByUser'],
      order: { blockTimestamp: 'DESC' },
    });

    // Calculate totals
    const totalMissed = missedPayments.reduce((sum, mp) => {
      return sum + BigInt(mp.amount.replace('.', '').padEnd(18, '0'));
    }, BigInt(0));

    // Map to DTOs
    const missedPaymentDtos: MissedPaymentDetailDto[] = missedPayments.map(mp => ({
      id: mp.id,
      orbit: mp.orbit,
      levelNumber: mp.levelNumber,
      amount: this.weiToEther(mp.amount.replace('.', '').padEnd(18, '0')),
      reason: mp.reason,
      cascadeDepth: mp.cascadeDepth,
      missedAt: mp.blockTimestamp,
      transactionHash: mp.transactionHash,
      triggeredByUserId: mp.triggeredByUser?.userId || null,
      triggeredByWallet: mp.triggeredByUser?.walletAddress || null,
      receivedByUserId: mp.receivedByUser?.userId || null,
      receivedByWallet: mp.receivedByUser?.walletAddress || null,
    }));

    return {
      userId: blockchainUserId,
      totalMissed: this.weiToEther(totalMissed.toString()),
      totalCount: missedPayments.length,
      missedPayments: missedPaymentDtos,
    };
  }

  /**
   * Get missed payments grouped by level for a user
   */
  async getMissedPaymentsByLevel(blockchainUserId: number): Promise<MissedPaymentsByLevelDto[]> {
    // Find user by blockchain ID
    const user = await this.userRepository.findOne({ 
      where: { userId: blockchainUserId } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${blockchainUserId} not found`);
    }

    // Query grouped by level
    const result = await this.missedPaymentRepository.query(
      `
      SELECT 
        mp.orbit,
        mp.level_number,
        COUNT(*) as times_missed,
        SUM(CAST(mp.amount AS DECIMAL(36, 18))) as total_amount_missed,
        mp.reason as primary_reason,
        MAX(mp.block_timestamp) as last_missed_at
      FROM missed_payments mp
      WHERE mp.missed_by_user_id = $1
      GROUP BY mp.orbit, mp.level_number, mp.reason
      ORDER BY mp.orbit, mp.level_number
      `,
      [user.id],
    );

    return result.map(row => ({
      orbit: row.orbit,
      levelNumber: parseInt(row.level_number),
      timesMissed: parseInt(row.times_missed),
      totalAmountMissed: this.weiToEther(row.total_amount_missed.toString().replace('.', '').padEnd(18, '0')),
      primaryReason: row.primary_reason,
      lastMissedAt: row.last_missed_at,
    }));
  }

  /**
   * Get missed payments for a specific level
   */
  async getMissedPaymentsForLevel(
    blockchainUserId: number,
    orbit: string,
    levelNumber: number,
  ): Promise<MissedPaymentDetailDto[]> {
    // Find user by blockchain ID
    const user = await this.userRepository.findOne({ 
      where: { userId: blockchainUserId } 
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${blockchainUserId} not found`);
    }

    // Get missed payments for specific level
    const missedPayments = await this.missedPaymentRepository.find({
      where: { 
        missedByUserId: user.id,
        orbit: orbit as any,
        levelNumber: levelNumber,
      },
      relations: ['triggeredByUser', 'receivedByUser'],
      order: { blockTimestamp: 'DESC' },
    });

    return missedPayments.map(mp => ({
      id: mp.id,
      orbit: mp.orbit,
      levelNumber: mp.levelNumber,
      amount: this.weiToEther(mp.amount.replace('.', '').padEnd(18, '0')),
      reason: mp.reason,
      cascadeDepth: mp.cascadeDepth,
      missedAt: mp.blockTimestamp,
      transactionHash: mp.transactionHash,
      triggeredByUserId: mp.triggeredByUser?.userId || null,
      triggeredByWallet: mp.triggeredByUser?.walletAddress || null,
      receivedByUserId: mp.receivedByUser?.userId || null,
      receivedByWallet: mp.receivedByUser?.walletAddress || null,
    }));
  }
}







