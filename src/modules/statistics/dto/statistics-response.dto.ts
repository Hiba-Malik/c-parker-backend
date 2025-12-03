import { ApiProperty } from '@nestjs/swagger';

export class PlatformStatsDto {
  @ApiProperty({ example: 1000 })
  totalUsers: number;

  @ApiProperty({ example: 950 })
  totalUsersOrbitA: number;

  @ApiProperty({ example: 900 })
  totalUsersOrbitB: number;

  @ApiProperty({ example: 25 })
  newUsersToday: number;

  @ApiProperty({ example: '50000000000000000000000' })
  totalCctEarned: string;

  @ApiProperty({ example: 5000 })
  totalTransactions: number;

  @ApiProperty({ example: '100000000000000000000000' })
  totalTurnover: string;
}

export class LeaderboardEntryDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty()
  totalEarned: string;

  @ApiProperty()
  totalPartners: number;

  @ApiProperty()
  totalTeamSize: number;
}

export class RecentUsersDto {
  @ApiProperty({ description: 'Blockchain user ID' })
  userId: number;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty({ description: 'Blockchain user ID of referrer' })
  referrerUserId: number;

  @ApiProperty()
  registeredAt: Date;

  @ApiProperty()
  hoursAgo: number;
}






