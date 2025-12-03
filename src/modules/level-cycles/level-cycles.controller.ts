import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LevelCyclesService } from './level-cycles.service';
import { UsersService } from '../users/users.service';
import { OrbitType } from '../../database/entities/user-level.entity';
import { User } from '../../database/entities/user.entity';
import { CyclePosition } from '../../database/entities/level-cycle.entity';
import { weiToEther } from '../../utils/wei-to-ether.util';

@ApiTags('Level Cycles')
@Controller('cycles')
export class LevelCyclesController {
  constructor(
    private readonly levelCyclesService: LevelCyclesService,
    private readonly usersService: UsersService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Helper method to convert internal user IDs to blockchain user IDs in positions
   */
  private async convertPositionsToBlockchainIds(
    positions: CyclePosition[],
  ): Promise<CyclePosition[]> {
    if (!positions || positions.length === 0) {
      return [];
    }

    // Get all internal user IDs from positions
    const internalUserIds = positions.map((p) => p.userId);

    // Fetch all users at once
    const users = await this.userRepository.find({
      where: { id: In(internalUserIds) },
      select: ['id', 'userId'],
    });

    // Create a map of internal ID -> blockchain ID
    const idMap = new Map<number, number>();
    users.forEach((user) => {
      idMap.set(user.id, user.userId);
    });

    // Map positions to use blockchain IDs
    return positions.map((position) => ({
      ...position,
      userId: idMap.get(position.userId) || position.userId,
    }));
  }

  @Get(':userId/:orbit/:levelNumber')
  @ApiOperation({ summary: 'Get cycle history for a user level' })
  @ApiParam({ name: 'userId', description: 'Blockchain user ID' })
  @ApiParam({ name: 'orbit', enum: ['ORBIT_A', 'ORBIT_B'] })
  @ApiParam({ name: 'levelNumber', description: 'Level number (1-10)' })
  @ApiResponse({ status: 200, description: 'Cycle history retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getCycleHistory(
    @Param('userId') userId: string,
    @Param('orbit') orbit: string,
    @Param('levelNumber') levelNumber: string,
  ) {
    // Convert blockchain userId to internal id
    const user = await this.usersService.findByUserId(parseInt(userId));
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const orbitType = orbit as OrbitType;
    const level = parseInt(levelNumber);

    const cycles = await this.levelCyclesService.getCycleHistory(
      user.id,
      orbitType,
      level,
    );

    // Convert all positions to use blockchain user IDs
    const cyclesWithBlockchainIds = await Promise.all(
      cycles.map(async (cycle) => ({
        cycleNumber: cycle.cycleNumber,
        startedAt: cycle.startedAt,
        completedAt: cycle.completedAt,
        totalEarnings: weiToEther(cycle.totalEarnings),
        positions: await this.convertPositionsToBlockchainIds(cycle.positions),
        positionsFilled: cycle.positions.length,
        maxPositions: orbitType === OrbitType.ORBIT_A ? 4 : 6,
        isActive: cycle.isActive,
        isComplete: !!cycle.completedAt,
        startTxHash: cycle.startTxHash,
        completionTxHash: cycle.completionTxHash,
      })),
    );

    return {
      userId: parseInt(userId),
      orbit: orbitType,
      levelNumber: level,
      totalCycles: cycles.length,
      cycles: cyclesWithBlockchainIds,
    };
  }

  @Get(':userId/:orbit/:levelNumber/current')
  @ApiOperation({ summary: 'Get current active cycle for a user level' })
  @ApiParam({ name: 'userId', description: 'Blockchain user ID' })
  @ApiParam({ name: 'orbit', enum: ['ORBIT_A', 'ORBIT_B'] })
  @ApiParam({ name: 'levelNumber', description: 'Level number (1-10)' })
  @ApiResponse({ status: 200, description: 'Active cycle retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User or active cycle not found' })
  async getCurrentCycle(
    @Param('userId') userId: string,
    @Param('orbit') orbit: string,
    @Param('levelNumber') levelNumber: string,
  ) {
    // Convert blockchain userId to internal id
    const user = await this.usersService.findByUserId(parseInt(userId));
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const orbitType = orbit as OrbitType;
    const level = parseInt(levelNumber);

    const cycle = await this.levelCyclesService.getActiveCycle(
      user.id,
      orbitType,
      level,
    );

    if (!cycle) {
      throw new NotFoundException(
        `No active cycle found for user ${userId}, ${orbit}, level ${level}`,
      );
    }

    const maxPositions = orbitType === OrbitType.ORBIT_A ? 4 : 6;

    // Convert positions to use blockchain user IDs
    const positions = await this.convertPositionsToBlockchainIds(cycle.positions);

    return {
      userId: parseInt(userId),
      orbit: orbitType,
      levelNumber: level,
      cycle: {
        cycleNumber: cycle.cycleNumber,
        startedAt: cycle.startedAt,
        completedAt: cycle.completedAt,
        totalEarnings: weiToEther(cycle.totalEarnings),
        positions,
        positionsFilled: positions.length,
        maxPositions,
        progress: `${positions.length}/${maxPositions}`,
        isActive: cycle.isActive,
        startTxHash: cycle.startTxHash,
      },
    };
  }
}

