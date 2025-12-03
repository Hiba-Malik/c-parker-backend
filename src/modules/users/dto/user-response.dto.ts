import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: 1, description: 'Internal database ID' })
  id: number;

  @ApiProperty({ example: 2, description: 'Blockchain user ID' })
  userId: number;

  @ApiProperty({ example: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb' })
  walletAddress: string;

  @ApiProperty({ example: 1, nullable: true, description: 'Blockchain user ID of referrer' })
  referrerId: number;

  @ApiProperty()
  registeredAt: Date;

  @ApiProperty({ example: '0x123...' })
  registrationTxHash: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class UserStatsDto {
  @ApiProperty({ example: 5, description: 'Total direct referrals (partners)' })
  totalPartners: number;

  @ApiProperty({ example: 2, description: 'New partners in last 24 hours' })
  partnersLast24h: number;

  @ApiProperty({ example: 25, description: 'Total team size (entire downline)' })
  totalTeamSize: number;

  @ApiProperty({ example: 7, description: 'New team members in last 24 hours' })
  teamLast24h: number;

  @ApiProperty({ example: '5000', description: 'Total CCT earned' })
  totalEarned: string;

  @ApiProperty({ example: '2000', description: 'Total CCT spent (registration + level purchases)' })
  totalSpent: string;

  @ApiProperty({ example: '2.50', description: 'Performance ratio (earned / spent)' })
  ratio: string;

  @ApiProperty({ example: '0.15', description: 'Change in ratio over last 24 hours' })
  ratioLast24h: string;

  @ApiProperty({ example: '500', description: 'Total CCT missed' })
  totalMissed: string;

  @ApiProperty({ example: 3 })
  orbitALevels: number;

  @ApiProperty({ example: 2 })
  orbitBLevels: number;

  @ApiProperty({ example: '3500' })
  orbitAEarned: string;

  @ApiProperty({ example: '1500' })
  orbitBEarned: string;

  @ApiProperty()
  lastActivityAt: Date;
}

export class UserTeamMemberDto {
  @ApiProperty({ description: 'Blockchain user ID' })
  userId: number;

  @ApiProperty()
  walletAddress: string;

  @ApiProperty()
  registeredAt: Date;

  @ApiProperty({ description: 'How many levels down in the tree' })
  level: number;
}






