import { Controller, Get, Param, Query, UseInterceptors, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { PaymentsService } from './payments.service';
import { PaymentResponseDto, LevelEarningsDto } from './dto/payment-response.dto';
import { UsersService } from '../users/users.service';

@ApiTags('payments')
@Controller('payments')
@UseInterceptors(CacheInterceptor)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all payments for user' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @CacheTTL(30)
  async getUserPayments(
    @Param('userId') userId: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<PaymentResponseDto[]> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.paymentsService.findAllByUser(user.id, limit, offset);
  }

  @Get('user/:userId/earned')
  @ApiOperation({ summary: 'Get received payments' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @CacheTTL(30)
  async getEarnedPayments(
    @Param('userId') userId: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<PaymentResponseDto[]> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.paymentsService.findReceivedPayments(user.id, limit, offset);
  }

  @Get('user/:userId/missed')
  @ApiOperation({ summary: 'Get missed payments' })
  @ApiResponse({ status: 200, type: [PaymentResponseDto] })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'offset', required: false, example: 0 })
  @CacheTTL(30)
  async getMissedPayments(
    @Param('userId') userId: number,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<PaymentResponseDto[]> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.paymentsService.findMissedPayments(user.id, limit, offset);
  }

  @Get('user/:userId/by-level')
  @ApiOperation({ summary: 'Get earnings grouped by level' })
  @ApiResponse({ status: 200, type: [LevelEarningsDto] })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(60)
  async getEarningsByLevel(
    @Param('userId') userId: number,
  ): Promise<LevelEarningsDto[]> {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.paymentsService.getEarningsByLevel(user.id);
  }

  @Get('user/:userId/total-earned')
  @ApiOperation({ 
    summary: 'Get total earnings breakdown',
    description: 'Returns profit, passive income, and earnings by orbit'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Total earnings breakdown',
    schema: {
      type: 'object',
      properties: {
        profit: { type: 'string', description: 'Total earnings in CCT', example: '150.5' },
        passiveIncome: { type: 'string', description: 'Earnings from non-direct referrals (spillover)', example: '75.25' },
        orbitAEarnings: { type: 'string', description: 'Total earnings from Orbit A', example: '100.0' },
        orbitBEarnings: { type: 'string', description: 'Total earnings from Orbit B', example: '50.5' },
        total: { type: 'string', description: 'Same as profit (for backwards compatibility)', example: '150.5' },
      }
    }
  })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(60)
  async getTotalEarned(@Param('userId') userId: number) {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.paymentsService.getTotalEarnings(user.id);
  }

  @Get('user/:userId/total-missed')
  @ApiOperation({ summary: 'Get total missed amount' })
  @ApiParam({ name: 'userId', example: 2, description: 'Blockchain user ID' })
  @CacheTTL(60)
  async getTotalMissed(@Param('userId') userId: number) {
    const user = await this.usersService.findByUserId(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    return this.paymentsService.getTotalMissed(user.id);
  }
}



