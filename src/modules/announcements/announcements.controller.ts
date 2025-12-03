import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Delete, 
  Body, 
  Param, 
  Query,
  ParseIntPipe,
  ParseBoolPipe,
  UseInterceptors 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';

@ApiTags('announcements')
@Controller('announcements')
@UseInterceptors(CacheInterceptor)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all announcements' })
  @ApiQuery({ name: 'includeHidden', required: false, type: Boolean, description: 'Include hidden announcements' })
  @ApiResponse({ status: 200, type: [AnnouncementResponseDto] })
  @CacheTTL(60) // Cache for 1 minute
  async findAll(
    @Query('includeHidden', new ParseBoolPipe({ optional: true })) includeHidden: boolean = true
  ): Promise<AnnouncementResponseDto[]> {
    return this.announcementsService.findAll(includeHidden);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get announcement by ID' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  @CacheTTL(120)
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<AnnouncementResponseDto> {
    return this.announcementsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new announcement' })
  @ApiBody({ type: CreateAnnouncementDto })
  @ApiResponse({ status: 201, type: AnnouncementResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(@Body() createDto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    return this.announcementsService.create(createDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an announcement' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiBody({ type: UpdateAnnouncementDto })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateAnnouncementDto
  ): Promise<AnnouncementResponseDto> {
    return this.announcementsService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an announcement' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, description: 'Announcement deleted successfully' })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
    await this.announcementsService.remove(id);
    return { message: 'Announcement deleted successfully' };
  }

  @Patch(':id/toggle-visibility')
  @ApiOperation({ summary: 'Toggle announcement visibility' })
  @ApiParam({ name: 'id', example: 1 })
  @ApiResponse({ status: 200, type: AnnouncementResponseDto })
  @ApiResponse({ status: 404, description: 'Announcement not found' })
  async toggleVisibility(@Param('id', ParseIntPipe) id: number): Promise<AnnouncementResponseDto> {
    return this.announcementsService.toggleVisibility(id);
  }
}



