import { ApiProperty } from '@nestjs/swagger';

export class PaymentResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  fromUserId: number;

  @ApiProperty()
  toUserId: number;

  @ApiProperty({ enum: ['ORBIT_A', 'ORBIT_B'] })
  orbit: string;

  @ApiProperty()
  levelNumber: number;

  @ApiProperty()
  amount: string;

  @ApiProperty({ enum: ['RECEIVED', 'MISSED'] })
  status: string;

  @ApiProperty()
  paymentType: string;

  @ApiProperty()
  transactionHash: string;

  @ApiProperty()
  blockTimestamp: Date;
}

export class LevelEarningsDto {
  @ApiProperty()
  levelNumber: number;

  @ApiProperty()
  orbit: string;

  @ApiProperty()
  earned: string;

  @ApiProperty()
  missed: string;

  @ApiProperty()
  recycleCount: number;

  @ApiProperty()
  paymentCount: number;

  @ApiProperty()
  missedCount: number;
}



