import { Controller, Get, Param, Query, UseInterceptors, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { UsersService } from './users.service';
import { UserResponseDto, UserStatsDto, UserTeamMemberDto } from './dto/user-response.dto';

@ApiTags('users')
@Controller('users')
@UseInterceptors(CacheInterceptor)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('levels/pricing')
  @ApiOperation({ summary: 'Get pricing for all levels (both Orbit A and Orbit B)' })
  @ApiResponse({ status: 200, description: 'Returns pricing information for all 10 levels' })
  @CacheTTL(300)
  async getAllLevelsPricing() {
    return this.usersService.getAllLevelsPricing();
  }

  @Get('wallet/:address')
  @ApiOperation({ summary: 'Get user by wallet address' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiParam({ name: 'address', example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  @CacheTTL(300)
  async getUserByWallet(@Param('address') address: string): Promise<UserResponseDto> {
    return this.usersService.findByWallet(address);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Get user by blockchain user ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(300)
  async getUser(@Param('userId') userId: number): Promise<UserResponseDto> {
    return this.usersService.findByUserId(userId);
  }

  @Get(':userId/referrals')
  @ApiOperation({ summary: 'Get direct referrals (partners)' })
  @ApiResponse({ status: 200, type: [UserResponseDto] })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(120)
  async getReferrals(@Param('userId') userId: number): Promise<UserResponseDto[]> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.usersService.getReferrals(user.id);
  }

  @Get(':userId/stats')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, type: UserStatsDto })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(60)
  async getUserStats(@Param('userId') userId: number): Promise<UserStatsDto> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.usersService.getStats(user.id);
  }

  @Get(':userId/team')
  @ApiOperation({ summary: 'Get entire team (recursive downlines)' })
  @ApiResponse({ status: 200, type: [UserTeamMemberDto] })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(300)
  async getTeam(@Param('userId') userId: number): Promise<UserTeamMemberDto[]> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.usersService.getTeam(user.id);
  }

  @Get(':userId/levels')
  @ApiOperation({ summary: 'Get user levels' })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @ApiQuery({ name: 'orbit', required: false, enum: ['ORBIT_A', 'ORBIT_B'] })
  @CacheTTL(60)
  async getLevels(
    @Param('userId') userId: number,
    @Query('orbit') orbit?: string,
  ) {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.usersService.getLevels(user.id, orbit);
  }

  @Get(':userId/matrix/:orbit/:level')
  @ApiOperation({ summary: 'Get matrix downlines for specific level' })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @ApiParam({ name: 'orbit', enum: ['ORBIT_A', 'ORBIT_B'] })
  @ApiParam({ name: 'level', example: 1 })
  @CacheTTL(60)
  async getMatrixDownlines(
    @Param('userId') userId: number,
    @Param('orbit') orbit: string,
    @Param('level') level: number,
  ) {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.usersService.getMatrixDownlines(user.id, orbit, level);
  }
}



