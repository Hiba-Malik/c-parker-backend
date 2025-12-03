import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { MissedPaymentsService } from './missed-payments.service';
import { 
  UserMissedPaymentsSummaryDto,
  MissedPaymentsByLevelDto,
  MissedPaymentDetailDto 
} from './dto/missed-payment-response.dto';

@ApiTags('Missed Payments')
@Controller('missed-payments')
export class MissedPaymentsController {
  constructor(private readonly missedPaymentsService: MissedPaymentsService) {}

  @Get('user/:userId')
  @ApiOperation({ 
    summary: 'Get all missed payments for a user',
    description: 'Returns detailed information about all missed payment opportunities, including who triggered them and who received instead'
  })
  @ApiParam({ name: 'userId', description: 'Blockchain user ID', type: Number })
  @ApiResponse({ status: 200, type: UserMissedPaymentsSummaryDto })
  async getUserMissedPayments(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserMissedPaymentsSummaryDto> {
    return this.missedPaymentsService.getUserMissedPayments(userId);
  }

  @Get('user/:userId/by-level')
  @ApiOperation({ 
    summary: 'Get missed payments grouped by level',
    description: 'Returns aggregated missed payment stats for each level the user has missed payments on'
  })
  @ApiParam({ name: 'userId', description: 'Blockchain user ID', type: Number })
  @ApiResponse({ status: 200, type: [MissedPaymentsByLevelDto] })
  async getMissedPaymentsByLevel(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<MissedPaymentsByLevelDto[]> {
    return this.missedPaymentsService.getMissedPaymentsByLevel(userId);
  }

  @Get('user/:userId/:orbit/:levelNumber')
  @ApiOperation({ 
    summary: 'Get missed payments for a specific level',
    description: 'Returns all missed payment details for a specific orbit and level'
  })
  @ApiParam({ name: 'userId', description: 'Blockchain user ID', type: Number })
  @ApiParam({ name: 'orbit', description: 'Orbit type', enum: ['ORBIT_A', 'ORBIT_B'] })
  @ApiParam({ name: 'levelNumber', description: 'Level number (1-10)', type: Number })
  @ApiResponse({ status: 200, type: [MissedPaymentDetailDto] })
  async getMissedPaymentsForLevel(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('orbit') orbit: string,
    @Param('levelNumber', ParseIntPipe) levelNumber: number,
  ): Promise<MissedPaymentDetailDto[]> {
    return this.missedPaymentsService.getMissedPaymentsForLevel(userId, orbit, levelNumber);
  }
}







