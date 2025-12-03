import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @ApiProperty({ 
    example: 'System Maintenance',
    description: 'Title of the announcement',
    maxLength: 255
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiProperty({ 
    example: 'The platform will be under maintenance from 2:00 AM to 4:00 AM UTC.',
    description: 'Body content of the announcement'
  })
  @IsString()
  @IsNotEmpty()
  body: string;
}


