import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryRunner } from 'typeorm';
import { LevelCycle, CyclePosition } from '../../database/entities/level-cycle.entity';
import { OrbitType } from '../../database/entities/user-level.entity';
import { User } from '../../database/entities/user.entity';

@Injectable()
export class LevelCyclesService {
  private readonly logger = new Logger(LevelCyclesService.name);

  constructor(
    @InjectRepository(LevelCycle)
    private levelCycleRepository: Repository<LevelCycle>,
  ) {}

  /**
   * Start a new cycle for a user when they purchase/reinvest in a level
   */
  async startCycle(
    userId: number,
    orbit: OrbitType,
    levelNumber: number,
    txHash: string,
    timestamp: Date,
    queryRunner?: QueryRunner,
  ): Promise<LevelCycle> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(LevelCycle)
      : this.levelCycleRepository;

    // Get the next cycle number
    const lastCycle = await repo.findOne({
      where: { userId, orbit, levelNumber },
      order: { cycleNumber: 'DESC' },
    });

    const cycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

    // Mark previous cycle as inactive if it exists
    if (lastCycle && lastCycle.isActive) {
      lastCycle.isActive = false;
      await repo.save(lastCycle);
    }

    // Create new cycle
    const cycle = repo.create({
      userId,
      orbit,
      levelNumber,
      cycleNumber,
      startedAt: timestamp,
      startTxHash: txHash,
      isActive: true,
      positions: [],
      totalEarnings: '0',
    });

    const saved = await repo.save(cycle);
    
    this.logger.log(
      `Started cycle ${cycleNumber} for user ${userId}, ${orbit}, level ${levelNumber}`,
    );

    return saved;
  }

  /**
   * Add a placement to the current active cycle
   */
  async addPlacement(
    uplineUserId: number,
    placedUserId: number,
    placedUserWallet: string,
    position: number,
    orbit: OrbitType,
    levelNumber: number,
    timestamp: Date,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(LevelCycle)
      : this.levelCycleRepository;

    // Get active cycle for the upline
    let cycle = await repo.findOne({
      where: {
        userId: uplineUserId,
        orbit,
        levelNumber,
        isActive: true,
      },
    });

    // If no active cycle exists (e.g., previous cycle completed), create a new one
    if (!cycle) {
      this.logger.log(
        `No active cycle found for user ${uplineUserId}, ${orbit}, level ${levelNumber} - creating new cycle`,
      );
      
      // Get the last cycle number
      const lastCycle = await repo.findOne({
        where: { userId: uplineUserId, orbit, levelNumber },
        order: { cycleNumber: 'DESC' },
      });

      const nextCycleNumber = lastCycle ? lastCycle.cycleNumber + 1 : 1;

      // Create new cycle
      cycle = repo.create({
        userId: uplineUserId,
        orbit,
        levelNumber,
        cycleNumber: nextCycleNumber,
        startedAt: timestamp,
        startTxHash: '0x0', // Placeholder - cycle started by placement, not purchase
        isActive: true,
        positions: [],
        totalEarnings: '0',
      });

      await repo.save(cycle);
      
      this.logger.log(
        `Created cycle ${nextCycleNumber} for user ${uplineUserId}, ${orbit}, level ${levelNumber}`,
      );
    }

    // Add placement to positions array
    const newPosition: CyclePosition = {
      position,
      userId: placedUserId,
      placedAt: timestamp.toISOString(),
      walletAddress: placedUserWallet,
    };

    cycle.positions = [...(cycle.positions || []), newPosition];

    // Check if cycle is complete
    // Orbit A: 4 positions (1-4), position 4 triggers recycle
    // Orbit B: 6 positions (1-6), position 6 triggers recycle
    const maxPositions = orbit === OrbitType.ORBIT_A ? 4 : 6;
    
    if (cycle.positions.length >= maxPositions) {
      // Cycle complete - mark as inactive (new cycle will start with next LevelPurchased)
      cycle.isActive = false;
      cycle.completedAt = timestamp;
      this.logger.log(
        `Cycle ${cycle.cycleNumber} completed for user ${uplineUserId}, ${orbit}, level ${levelNumber} (${cycle.positions.length}/${maxPositions} positions filled)`,
      );
    }

    await repo.save(cycle);
  }

  /**
   * Add earnings to the current active cycle
   */
  async addEarnings(
    userId: number,
    orbit: OrbitType,
    levelNumber: number,
    amount: string,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(LevelCycle)
      : this.levelCycleRepository;

    const cycle = await repo.findOne({
      where: {
        userId,
        orbit,
        levelNumber,
        isActive: true,
      },
    });

    if (!cycle) {
      this.logger.warn(
        `No active cycle found for earnings - user ${userId}, ${orbit}, level ${levelNumber}`,
      );
      return;
    }

    // Add to total earnings
    const currentEarnings = parseFloat(cycle.totalEarnings) || 0;
    const additionalEarnings = parseFloat(amount) || 0;
    cycle.totalEarnings = (currentEarnings + additionalEarnings).toFixed(18);

    await repo.save(cycle);
  }

  /**
   * Complete a cycle
   */
  async completeCycle(
    userId: number,
    orbit: OrbitType,
    levelNumber: number,
    txHash: string,
    timestamp: Date,
    queryRunner?: QueryRunner,
  ): Promise<void> {
    const repo = queryRunner
      ? queryRunner.manager.getRepository(LevelCycle)
      : this.levelCycleRepository;

    const cycle = await repo.findOne({
      where: {
        userId,
        orbit,
        levelNumber,
        isActive: true,
      },
    });

    if (!cycle) {
      this.logger.warn(
        `No active cycle to complete for user ${userId}, ${orbit}, level ${levelNumber}`,
      );
      return;
    }

    cycle.completedAt = timestamp;
    cycle.completionTxHash = txHash;
    cycle.isActive = false;

    await repo.save(cycle);

    this.logger.log(
      `Completed cycle ${cycle.cycleNumber} for user ${userId}, ${orbit}, level ${levelNumber}`,
    );
  }

  /**
   * Get all cycles for a user's level
   */
  async getCycleHistory(
    userId: number,
    orbit: OrbitType,
    levelNumber: number,
  ): Promise<LevelCycle[]> {
    return this.levelCycleRepository.find({
      where: { userId, orbit, levelNumber },
      order: { cycleNumber: 'ASC' },
    });
  }

  /**
   * Get active cycle for a user's level
   */
  async getActiveCycle(
    userId: number,
    orbit: OrbitType,
    levelNumber: number,
  ): Promise<LevelCycle | null> {
    return this.levelCycleRepository.findOne({
      where: {
        userId,
        orbit,
        levelNumber,
        isActive: true,
      },
    });
  }

  /**
   * Get cycle by ID
   */
  async getCycleById(id: number): Promise<LevelCycle | null> {
    return this.levelCycleRepository.findOne({
      where: { id },
    });
  }
}

