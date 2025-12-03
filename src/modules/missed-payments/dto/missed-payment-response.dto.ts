import { ApiProperty } from '@nestjs/swagger';

export class MissedPaymentDetailDto {
  @ApiProperty({ example: 1, description: 'Missed payment ID' })
  id: number;

  @ApiProperty({ example: 'ORBIT_A' })
  orbit: string;

  @ApiProperty({ example: 3 })
  levelNumber: number;

  @ApiProperty({ example: '50', description: 'Amount in CCT' })
  amount: string;

  @ApiProperty({ example: 'LEVEL_NOT_ACTIVATED', description: 'Reason for missing payment' })
  reason: string;

  @ApiProperty({ example: 0, description: 'How many levels it cascaded' })
  cascadeDepth: number;

  @ApiProperty({ example: '2025-11-22T16:29:31.000Z' })
  missedAt: Date;

  @ApiProperty({ example: '0x123...', description: 'Transaction hash' })
  transactionHash: string;

  // Who triggered this payment (bought the level)
  @ApiProperty({ example: 45, description: 'Blockchain user ID who triggered this payment', nullable: true })
  triggeredByUserId: number | null;

  @ApiProperty({ example: '0x742d35...', description: 'Wallet of user who triggered', nullable: true })
  triggeredByWallet: string | null;

  // Who received it instead
  @ApiProperty({ example: 12, description: 'Blockchain user ID who received instead', nullable: true })
  receivedByUserId: number | null;

  @ApiProperty({ example: '0x886f7d...', description: 'Wallet of user who received instead', nullable: true })
  receivedByWallet: string | null;
}

export class UserMissedPaymentsSummaryDto {
  @ApiProperty({ example: 2, description: 'Blockchain user ID' })
  userId: number;

  @ApiProperty({ example: '450', description: 'Total amount missed in CCT' })
  totalMissed: string;

  @ApiProperty({ example: 7, description: 'Number of missed opportunities' })
  totalCount: number;

  @ApiProperty({ type: [MissedPaymentDetailDto] })
  missedPayments: MissedPaymentDetailDto[];
}

export class MissedPaymentsByLevelDto {
  @ApiProperty({ example: 'ORBIT_A' })
  orbit: string;

  @ApiProperty({ example: 3 })
  levelNumber: number;

  @ApiProperty({ example: 5, description: 'Times missed' })
  timesMissed: number;

  @ApiProperty({ example: '250', description: 'Total amount missed in CCT' })
  totalAmountMissed: string;

  @ApiProperty({ example: 'LEVEL_NOT_ACTIVATED' })
  primaryReason: string;

  @ApiProperty({ example: '2025-11-22T16:29:31.000Z', description: 'Last time missed' })
  lastMissedAt: Date;
}







