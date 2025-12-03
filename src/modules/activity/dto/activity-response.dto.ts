import { ApiProperty } from '@nestjs/swagger';

export class ActivityFeedDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  eventName: string;

  @ApiProperty({ enum: ['OrbitA', 'OrbitB'] })
  contract: string;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty({ nullable: true })
  levelNumber: number;

  @ApiProperty({ nullable: true })
  amount: string;

  @ApiProperty()
  transactionHash: string;

  @ApiProperty()
  blockTimestamp: Date;

  @ApiProperty()
  secondsAgo: number;
}






