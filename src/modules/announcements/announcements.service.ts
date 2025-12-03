import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../database/entities/announcement.entity';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { AnnouncementResponseDto } from './dto/announcement-response.dto';

@Injectable()
export class AnnouncementsService {
  constructor(
    @InjectRepository(Announcement)
    private announcementRepository: Repository<Announcement>,
  ) {}

  /**
   * Get all announcements (sorted by newest first)
   */
  async findAll(includeHidden: boolean = true): Promise<AnnouncementResponseDto[]> {
    const whereClause = includeHidden ? {} : { isHidden: false };
    
    const announcements = await this.announcementRepository.find({
      where: whereClause,
      order: { createdAt: 'DESC' },
    });

    return announcements;
  }

  /**
   * Get a single announcement by ID
   */
  async findOne(id: number): Promise<AnnouncementResponseDto> {
    const announcement = await this.announcementRepository.findOne({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with ID ${id} not found`);
    }

    return announcement;
  }

  /**
   * Create a new announcement
   */
  async create(createDto: CreateAnnouncementDto): Promise<AnnouncementResponseDto> {
    const announcement = this.announcementRepository.create({
      title: createDto.title,
      body: createDto.body,
      isHidden: false,
    });

    const saved = await this.announcementRepository.save(announcement);
    return saved;
  }

  /**
   * Update an existing announcement
   */
  async update(id: number, updateDto: UpdateAnnouncementDto): Promise<AnnouncementResponseDto> {
    const announcement = await this.findOne(id);

    // Update only provided fields
    if (updateDto.title !== undefined) {
      announcement.title = updateDto.title;
    }
    if (updateDto.body !== undefined) {
      announcement.body = updateDto.body;
    }
    if (updateDto.isHidden !== undefined) {
      announcement.isHidden = updateDto.isHidden;
    }

    const updated = await this.announcementRepository.save(announcement);
    return updated;
  }

  /**
   * Delete an announcement
   */
  async remove(id: number): Promise<void> {
    const announcement = await this.findOne(id);
    await this.announcementRepository.remove(announcement);
  }

  /**
   * Toggle visibility of an announcement
   */
  async toggleVisibility(id: number): Promise<AnnouncementResponseDto> {
    const announcement = await this.findOne(id);
    announcement.isHidden = !announcement.isHidden;
    const updated = await this.announcementRepository.save(announcement);
    return updated;
  }
}



