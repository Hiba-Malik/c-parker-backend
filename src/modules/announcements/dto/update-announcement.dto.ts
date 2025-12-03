import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, MaxLength } from 'class-validator';

export class UpdateAnnouncementDto {
  @ApiProperty({ 
    example: 'Updated System Maintenance',
    description: 'Title of the announcement',
    required: false
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ 
    example: 'Updated maintenance schedule...',
    description: 'Body content of the announcement',
    required: false
  })
  @IsString()
  @IsOptional()
  body?: string;

  @ApiProperty({ 
    example: false,
    description: 'Whether the announcement is hidden',
    required: false
  })
  @IsBoolean()
  @IsOptional()
  isHidden?: boolean;
}



