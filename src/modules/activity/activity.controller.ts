import { Controller, Get, Param, Query, UseInterceptors, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ActivityService } from './activity.service';
import { ActivityFeedDto } from './dto/activity-response.dto';
import { UsersService } from '../users/users.service';

@ApiTags('activity')
@Controller('activity')
@UseInterceptors(CacheInterceptor)
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get platform activity feed' })
  @ApiResponse({ status: 200, type: [ActivityFeedDto] })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @ApiQuery({
    name: 'eventNames',
    required: false,
    type: [String],
    description: 'Filter by event names (e.g., PaymentSent,UserRegistered)',
    example: 'PaymentSent,UserRegistered',
  })
  @CacheTTL(30)
  async getActivityFeed(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('eventNames') eventNames?: string,
  ): Promise<ActivityFeedDto[]> {
    // Parse comma-separated eventNames string into array
    const eventNamesArray = eventNames
      ? eventNames.split(',').map((name) => name.trim())
      : undefined;

    return this.activityService.getActivityFeed(
      limit || 50,
      offset || 0,
      eventNamesArray,
    );
  }

  @Get('recent/24h')
  @ApiOperation({ summary: 'Get activity from the last 24 hours' })
  @ApiResponse({ status: 200, type: [ActivityFeedDto] })
  @ApiQuery({ name: 'limit', required: false, example: 100 })
  @ApiQuery({
    name: 'eventNames',
    required: false,
    type: [String],
    description: 'Filter by event names (e.g., PaymentSent,UserRegistered)',
    example: 'PaymentSent,UserRegistered',
  })
  @CacheTTL(60)
  async getActivityLast24Hours(
    @Query('limit') limit?: number,
    @Query('eventNames') eventNames?: string,
  ): Promise<ActivityFeedDto[]> {
    // Parse comma-separated eventNames string into array
    const eventNamesArray = eventNames
      ? eventNames.split(',').map((name) => name.trim())
      : undefined;

    return this.activityService.getActivityLast24Hours(
      limit || 100,
      eventNamesArray,
    );
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get activity for specific user' })
  @ApiParam({ name: 'userId', description: 'Blockchain user ID' })
  @ApiResponse({ status: 200, type: [ActivityFeedDto] })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @CacheTTL(60)
  async getUserActivity(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ): Promise<ActivityFeedDto[]> {
    // Convert blockchain userId to internal id
    const user = await this.usersService.findByUserId(parseInt(userId));
    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    return this.activityService.getUserActivity(user.id, limit || 50);
  }
}



