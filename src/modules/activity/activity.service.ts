import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Event } from '../../database/entities';
import { ActivityFeedDto } from './dto/activity-response.dto';
import { weiToEther } from '../../utils/wei-to-ether.util';

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
  ) {}

  async getActivityFeed(
    limit: number = 50,
    offset: number = 0,
    eventNames?: string[],
  ): Promise<ActivityFeedDto[]> {
    // Check cache for first page (only if no filters)
    if (offset === 0 && !eventNames) {
      const cacheKey = `activity:feed:${limit}`;
      const cached = await this.cacheManager.get<ActivityFeedDto[]>(cacheKey);
      if (cached) return cached;
    }

    // Build query with optional eventName filter
    // For PaymentSent events, join with payments table to get the actual amount
    let query = `
      SELECT 
        e.id,
        e.event_name,
        e.contract,
        u.user_id,
        u.wallet_address,
        e.level_number,
        CASE 
          WHEN e.event_name = 'PaymentSent' THEN 
            CASE 
              WHEN p.amount IS NULL THEN NULL
              ELSE to_char(p.amount, 'FM999999999999999999.999999999999999999')
            END
          ELSE COALESCE(
            (e.event_data->>'amount')::text,
            (e.event_data->>'cctAmount')::text
          )
        END as amount,
        e.transaction_hash,
        e.block_timestamp,
        EXTRACT(EPOCH FROM (NOW() - e.block_timestamp))::INTEGER as seconds_ago
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT amount 
        FROM payments 
        WHERE transaction_hash = e.transaction_hash 
          AND (
            (e.contract = 'OrbitA' AND orbit = 'ORBIT_A') OR
            (e.contract = 'OrbitB' AND orbit = 'ORBIT_B')
          )
        LIMIT 1
      ) p ON e.event_name = 'PaymentSent'
      WHERE e.event_name IN (
        'UserRegistered',
        'OrbitBActivated', 
        'LevelPurchased',
        'PaymentSent'
      )
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Add eventName filter if provided
    if (eventNames && eventNames.length > 0) {
      query += ` AND e.event_name = ANY($${paramIndex})`;
      params.push(eventNames);
      paramIndex++;
    }

    query += ` ORDER BY e.block_timestamp DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.eventRepository.query(query, params);

    const activities: ActivityFeedDto[] = result.map((row) => ({
      id: row.id,
      eventName: row.event_name,
      contract: row.contract,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      levelNumber: row.level_number,
      amount: weiToEther(row.amount),
      transactionHash: row.transaction_hash,
      blockTimestamp: row.block_timestamp,
      secondsAgo: parseInt(row.seconds_ago) || 0,
    }));

    // Cache first page for 30 seconds (only if no filters)
    if (offset === 0 && !eventNames) {
      await this.cacheManager.set(`activity:feed:${limit}`, activities, 30);
    }

    return activities;
  }

  async getUserActivity(internalUserId: number, limit: number = 50): Promise<ActivityFeedDto[]> {
    const events = await this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .where('event.userId = :userId', { userId: internalUserId })
      .orderBy('event.blockTimestamp', 'DESC')
      .limit(limit)
      .getMany();

    return events.map((event) => {
      const secondsAgo = Math.floor(
        (Date.now() - event.blockTimestamp.getTime()) / 1000,
      );

      return {
        id: event.id,
        eventName: event.eventName,
        contract: event.contract,
        userId: event.user?.userId || 0, // Use blockchain user ID
        walletAddress: event.user?.walletAddress || '',
        levelNumber: event.levelNumber,
        amount: weiToEther(event.eventData?.amount),
        transactionHash: event.transactionHash,
        blockTimestamp: event.blockTimestamp,
        secondsAgo,
      };
    });
  }

  async getActivityLast24Hours(
    limit: number = 100,
    eventNames?: string[],
  ): Promise<ActivityFeedDto[]> {
    // Check cache (only if no filters)
    if (!eventNames) {
      const cacheKey = `activity:24h:${limit}`;
      const cached = await this.cacheManager.get<ActivityFeedDto[]>(cacheKey);
      if (cached) return cached;
    }

    // Query for events in the last 24 hours
    let query = `
      SELECT 
        e.id,
        e.event_name,
        e.contract,
        u.user_id,
        u.wallet_address,
        e.level_number,
        CASE 
          WHEN e.event_name = 'PaymentSent' THEN 
            CASE 
              WHEN p.amount IS NULL THEN NULL
              ELSE to_char(p.amount, 'FM999999999999999999.999999999999999999')
            END
          ELSE COALESCE(
            (e.event_data->>'amount')::text,
            (e.event_data->>'cctAmount')::text
          )
        END as amount,
        e.transaction_hash,
        e.block_timestamp,
        EXTRACT(EPOCH FROM (NOW() - e.block_timestamp))::INTEGER as seconds_ago
      FROM events e
      LEFT JOIN users u ON e.user_id = u.id
      LEFT JOIN LATERAL (
        SELECT amount 
        FROM payments 
        WHERE transaction_hash = e.transaction_hash 
          AND (
            (e.contract = 'OrbitA' AND orbit = 'ORBIT_A') OR
            (e.contract = 'OrbitB' AND orbit = 'ORBIT_B')
          )
        LIMIT 1
      ) p ON e.event_name = 'PaymentSent'
      WHERE e.event_name IN (
        'UserRegistered',
        'OrbitBActivated', 
        'LevelPurchased',
        'PaymentSent'
      )
      AND e.block_timestamp >= NOW() - INTERVAL '24 hours'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Add eventName filter if provided
    if (eventNames && eventNames.length > 0) {
      query += ` AND e.event_name = ANY($${paramIndex})`;
      params.push(eventNames);
      paramIndex++;
    }

    query += ` ORDER BY e.block_timestamp DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await this.eventRepository.query(query, params);

    const activities: ActivityFeedDto[] = result.map((row) => ({
      id: row.id,
      eventName: row.event_name,
      contract: row.contract,
      userId: row.user_id,
      walletAddress: row.wallet_address,
      levelNumber: row.level_number,
      amount: weiToEther(row.amount),
      transactionHash: row.transaction_hash,
      blockTimestamp: row.block_timestamp,
      secondsAgo: parseInt(row.seconds_ago) || 0,
    }));

    // Cache for 60 seconds (only if no filters)
    if (!eventNames) {
      await this.cacheManager.set(`activity:24h:${limit}`, activities, 60);
    }

    return activities;
  }
}



