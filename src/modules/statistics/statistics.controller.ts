import { Controller, Get, Query, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { StatisticsService } from './statistics.service';
import { PlatformStatsDto, LeaderboardEntryDto, RecentUsersDto } from './dto/statistics-response.dto';

@ApiTags('statistics')
@Controller('statistics')
@UseInterceptors(CacheInterceptor)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('platform')
  @ApiOperation({ summary: 'Get platform-wide statistics' })
  @ApiResponse({ status: 200, type: PlatformStatsDto })
  @CacheTTL(300)
  async getPlatformStats(): Promise<PlatformStatsDto> {
    return this.statisticsService.getPlatformStats();
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get top earners leaderboard' })
  @ApiResponse({ status: 200, type: [LeaderboardEntryDto] })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @CacheTTL(600)
  async getLeaderboard(
    @Query('limit') limit?: number,
  ): Promise<LeaderboardEntryDto[]> {
    return this.statisticsService.getLeaderboard(limit || 100);
  }

  @Get('recent-users')
  @ApiOperation({ summary: 'Get recently registered users' })
  @ApiResponse({ status: 200, type: [RecentUsersDto] })
  @ApiQuery({ name: 'hours', required: false, example: 24 })
  @CacheTTL(60)
  async getRecentUsers(
    @Query('hours') hours?: number,
  ): Promise<RecentUsersDto[]> {
    return this.statisticsService.getRecentUsers(hours || 24);
  }
}



