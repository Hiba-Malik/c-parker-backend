import { ApiProperty } from '@nestjs/swagger';

export class AnnouncementResponseDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'System Maintenance' })
  title: string;

  @ApiProperty({ example: 'The platform will be under maintenance on...' })
  body: string;

  @ApiProperty({ example: false })
  isHidden: boolean;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;
}


