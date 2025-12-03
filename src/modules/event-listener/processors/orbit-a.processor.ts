import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User, UserLevel, Payment, Event, OrbitType, PaymentStatus } from '../../../database/entities';
import { MissedPayment, MissedPaymentReason } from '../../../database/entities/missed-payment.entity';
import { BlockchainService } from '../services/blockchain.service';
import { LevelCyclesService } from '../../level-cycles/level-cycles.service';

@Injectable()
export class OrbitAProcessor {
  private readonly logger = new Logger(OrbitAProcessor.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserLevel)
    private userLevelRepository: Repository<UserLevel>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Event)
    private eventRepository: Repository<Event>,
    @InjectRepository(MissedPayment)
    private missedPaymentRepository: Repository<MissedPayment>,
    private dataSource: DataSource,
    private blockchainService: BlockchainService,
    private levelCyclesService: LevelCyclesService,
  ) {}

  // Helper to extract transaction hash from event
  private getTxHash(event: any): string {
    return event.log?.transactionHash || event.transactionHash || event.hash;
  }

  // Helper to extract block number from event
  private getBlockNumber(event: any): number {
    return event.log?.blockNumber || event.blockNumber || 0;
  }

  // Helper to extract log index from event
  private getLogIndex(event: any): number {
    return event.log?.index || event.index || 0;
  }

  // Get actual block timestamp from blockchain using block number from event
  private async getBlockTimestamp(event: any): Promise<Date> {
    try {
      const blockNumber = this.getBlockNumber(event);
      if (blockNumber > 0) {
        const provider = this.blockchainService.getProvider();
        const block = await provider.getBlock(blockNumber);
        if (block) {
          return new Date(block.timestamp * 1000);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not fetch block timestamp: ${error.message}`);
    }
    // Fallback to current time if blockchain fetch fails
    return new Date();
  }

  // Convert BigInt wei amount to decimal string for PostgreSQL DECIMAL(36, 18)
  private weiToDecimal(weiAmount: bigint): string {
    const divisor = BigInt('1000000000000000000'); // 10^18 as BigInt
    const wholePart = weiAmount / divisor;
    const remainder = weiAmount % divisor;
    
    // Format remainder with leading zeros to ensure 18 decimal places
    const remainderStr = remainder.toString().padStart(18, '0');
    
    // Remove trailing zeros for cleaner output, but keep at least one decimal place
    const decimalPart = remainderStr.replace(/0+$/, '') || '0';
    
    return `${wholePart}.${decimalPart}`;
  }

  async handleUserRegistered(...args) {
    const event = args[args.length - 1];
    const [userID, userAddress, referrerID, cctAmount, timestamp] = args;

    const blockTimestamp = await this.getBlockTimestamp(event);
    const txHash = this.getTxHash(event);

    // Log event with all params
    this.logger.log(`[OrbitA] UserRegistered: UserID=${userID}, Address=${userAddress}, ReferrerID=${referrerID}, Amount=${cctAmount.toString()}, TxHash=${txHash}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find referrer
      let referrer = null;
      if (Number(referrerID) > 0) {
        referrer = await this.userRepository.findOne({ where: { userId: Number(referrerID) } });
      }

      // Create or get user
      let user = await this.userRepository.findOne({ where: { userId: Number(userID) } });

      if (!user) {
        // If no referrer provided (referrerID = 0), default to admin user (ID 1)
        const finalReferrerId = referrer?.id || 1;

        user = this.userRepository.create({
          userId: Number(userID),
          walletAddress: userAddress.toLowerCase(),
          referrerId: finalReferrerId,
          registeredAt: blockTimestamp,
          registrationTxHash: txHash,
        });

        await queryRunner.manager.save(user);
        this.logger.log(`  → User created (referrer: ${finalReferrerId})`);
      } else {
        this.logger.log(`  → User already exists`);
      }

      // Activate level 1 for Orbit A
      let level1 = await this.userLevelRepository.findOne({
        where: {
          userId: user.id,
          orbit: OrbitType.ORBIT_A,
          levelNumber: 1,
        },
      });

      if (!level1) {
        level1 = this.userLevelRepository.create({
          userId: user.id,
          orbit: OrbitType.ORBIT_A,
          levelNumber: 1,
          isActive: true,
          activatedAt: blockTimestamp,
          activationTxHash: txHash,
        });

        await queryRunner.manager.save(level1);
        this.logger.log(`  → Level 1 activated`);

        // Start cycle 1 for this level
        await this.levelCyclesService.startCycle(
          user.id,
          OrbitType.ORBIT_A,
          1,
          txHash,
          blockTimestamp,
          queryRunner,
        );
        this.logger.log(`  → Cycle 1 started`);
      } else {
        this.logger.log(`  → Level 1 already active`);
      }

      // Store raw event
      const eventRecord = this.eventRepository.create({
        eventName: 'UserRegistered',
        contract: 'OrbitA',
        userId: user.id,
        levelNumber: 1, // UserRegistered automatically activates level 1
        eventData: {
          userID: userID.toString(),
          userAddress,
          referrerID: referrerID.toString(),
          cctAmount: cctAmount.toString(),
          timestamp: timestamp.toString(),
        },
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp,
        logIndex: this.getLogIndex(event),
      });

      await queryRunner.manager.save(eventRecord);
      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error processing UserRegistered: ${error.message}`, error.stack);
    } finally {
      await queryRunner.release();
    }
  }

  async handleDualOrbitRegistration(...args) {
    const event = args[args.length - 1];
    const [userID, userAddress, totalCCT, orbitACCT, orbitBCCT, timestamp] = args;

    this.logger.log(`[OrbitA] DualOrbitRegistration: ID=${userID}, Total=${totalCCT}`);

    try {
      const user = await this.userRepository.findOne({ where: { userId: Number(userID) } });
      
      if (user) {
        const blockTimestamp = await this.getBlockTimestamp(event);

        const eventRecord = this.eventRepository.create({
          eventName: 'DualOrbitRegistration',
          contract: 'OrbitA',
          userId: user.id,
          eventData: {
            userID: userID.toString(),
            userAddress,
            totalCCT: totalCCT.toString(),
            orbitACCT: orbitACCT.toString(),
            orbitBCCT: orbitBCCT.toString(),
            timestamp: timestamp.toString(),
          },
          transactionHash: this.getTxHash(event),
          blockNumber: this.getBlockNumber(event).toString(),
          blockTimestamp,
          logIndex: this.getLogIndex(event),
        });

        await this.eventRepository.save(eventRecord);
      }
    } catch (error) {
      this.logger.error(`Error processing DualOrbitRegistration: ${error.message}`);
    }
  }

  async handleLevelPurchased(...args) {
    const event = args[args.length - 1];
    const [userID, level, cctAmount, timestamp] = args;

    const blockTimestamp = await this.getBlockTimestamp(event);
    const txHash = this.getTxHash(event);

    this.logger.log(`[OrbitA] LevelPurchased: ID=${userID}, Level=${level}`);

    try {
      const user = await this.userRepository.findOne({ where: { userId: Number(userID) } });
      
      if (!user) {
        this.logger.warn(`User ${userID} not found for LevelPurchased`);
        return;
      }

      // Activate the level
      let userLevel = await this.userLevelRepository.findOne({
        where: {
          userId: user.id,
          orbit: OrbitType.ORBIT_A,
          levelNumber: Number(level),
        },
      });

      if (!userLevel) {
        userLevel = this.userLevelRepository.create({
          userId: user.id,
          orbit: OrbitType.ORBIT_A,
          levelNumber: Number(level),
          isActive: true,
          activatedAt: blockTimestamp,
          activationTxHash: txHash,
        });

        await this.userLevelRepository.save(userLevel);
        this.logger.log(`✓ Activated Orbit A Level ${level} for user ${userID}`);

        // Start a new cycle for this level
        await this.levelCyclesService.startCycle(
          user.id,
          OrbitType.ORBIT_A,
          Number(level),
          txHash,
          blockTimestamp,
        );
        this.logger.log(`✓ Started cycle for Orbit A Level ${level}`);
      } else {
        // Level already exists - this might be a reinvest/recycle
        // Start a new cycle (will increment cycle number)
        await this.levelCyclesService.startCycle(
          user.id,
          OrbitType.ORBIT_A,
          Number(level),
          txHash,
          blockTimestamp,
        );
        this.logger.log(`✓ Started new cycle for Orbit A Level ${level}`);
      }

      // Store event
      const eventRecord = this.eventRepository.create({
        eventName: 'LevelPurchased',
        contract: 'OrbitA',
        userId: user.id,
        levelNumber: Number(level),
        eventData: {
          userID: userID.toString(),
          level: level.toString(),
          cctAmount: cctAmount.toString(),
          timestamp: timestamp.toString(),
        },
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp,
        logIndex: this.getLogIndex(event),
      });

      await this.eventRepository.save(eventRecord);

    } catch (error) {
      this.logger.error(`Error processing LevelPurchased: ${error.message}`);
    }
  }

  async handleNewPlacement(...args) {
    const event = args[args.length - 1];
    const [userID, uplineID, level, position, timestamp] = args;

    const blockTimestamp = await this.getBlockTimestamp(event);

    // Log event with all params
    this.logger.log(`[OrbitA] NewPlacement: User=${userID}, Upline=${uplineID}, Level=${level}, Position=${position}, TxHash=${this.getTxHash(event)}`);

    try {
      // Users may not be saved yet (events process in parallel)
      // Retry with delay to wait for users to be created
      let user = null;
      let upline = null;
      let attempts = 0;
      const maxAttempts = 5;
      
      while ((!user || !upline) && attempts < maxAttempts) {
        if (!user) {
          user = await this.userRepository.findOne({ where: { userId: Number(userID) } });
        }
        if (!upline) {
          upline = await this.userRepository.findOne({ where: { userId: Number(uplineID) } });
        }
        
        if (!user || !upline) {
          if (attempts < maxAttempts - 1) {
            this.logger.log(`  → Waiting for users... (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
          attempts++;
        } else {
          this.logger.log(`  → Found user: ${user.userId}, upline: ${upline.userId}`);
          break;
        }
      }
      
      if (!user || !upline) {
        this.logger.warn(`  → User ${userID} or Upline ${uplineID} not found after ${maxAttempts} attempts`);
        return;
      }

      // Update user level with upline info
      // Retry to find user level (it might not be created yet)
      let userLevel = await this.userLevelRepository.findOne({
        where: {
          userId: user.id,
          orbit: OrbitType.ORBIT_A,
          levelNumber: Number(level),
        },
      });

      if (!userLevel) {
        // User level might not exist yet, retry a few times
        attempts = 0;
        while (!userLevel && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 100));
          userLevel = await this.userLevelRepository.findOne({
            where: {
              userId: user.id,
              orbit: OrbitType.ORBIT_A,
              levelNumber: Number(level),
            },
          });
          attempts++;
        }
      }

      if (userLevel) {
        // Save placement (all positions 1-4 are real placements)
        userLevel.uplineId = upline.id;
        userLevel.positionInUpline = Number(position);
        await this.userLevelRepository.save(userLevel);
        this.logger.log(`  → Placement updated (upline_id: ${upline.id}, position: ${position})`);

        // Add this placement to upline's active cycle
        await this.levelCyclesService.addPlacement(
          upline.id,
          user.id,
          user.walletAddress,
          Number(position),
          OrbitType.ORBIT_A,
          Number(level),
          blockTimestamp,
        );

        // Position 4 completes the cycle and triggers recycle
        const isCycleComplete = Number(position) === 4;
        if (isCycleComplete) {
          this.logger.log(`  → Cycle completed! Position 4 filled, upline ${upline.userId} will recycle`);
          // Note: The upline will get a new LevelPurchased event which will start their next cycle
        } else {
          this.logger.log(`  → Added to upline's cycle (${Number(position)}/4 positions)`);
        }
      } else {
        this.logger.warn(`  → User level not found for user ${userID}, orbit ORBIT_A, level ${level}`);
      }

      // Store event
      const eventRecord = this.eventRepository.create({
        eventName: 'NewPlacement',
        contract: 'OrbitA',
        userId: user.id,
        levelNumber: Number(level),
        eventData: {
          userID: userID.toString(),
          uplineID: uplineID.toString(),
          level: level.toString(),
          position: position.toString(),
          timestamp: timestamp.toString(),
        },
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp,
        logIndex: this.getLogIndex(event),
      });

      await this.eventRepository.save(eventRecord);

    } catch (error) {
      this.logger.error(`Error processing NewPlacement: ${error.message}`);
    }
  }

  async handlePaymentSent(...args) {
    const event = args[args.length - 1];
    const [fromUserID, toUserID, level, cctAmount, position, paymentType] = args;

    const blockTimestamp = await this.getBlockTimestamp(event);

    // Log event with all params
    this.logger.log(`[OrbitA] PaymentSent: From=${fromUserID}, To=${toUserID}, Level=${level}, Amount=${cctAmount.toString()}, Position=${position}, Type=${paymentType}, TxHash=${this.getTxHash(event)}`);

    try {
      const txHash = this.getTxHash(event);
      let fromUser = null;

      if (fromUserID > 0) {
        // Payment from another user (e.g., cascade payment)
        fromUser = await this.userRepository.findOne({ where: { userId: Number(fromUserID) } });
      } else {
        // fromUserID = 0 means payment from contract/system
        // Could be from registration (UserRegistered) or level purchase (LevelPurchased)
        // Look up which user triggered this payment in the same transaction
        // Events may process in parallel, so we retry with a small delay
        let attempts = 0;
        const maxAttempts = 5;
        
        while (!fromUser && attempts < maxAttempts) {
          // First try to find LevelPurchased event (for level purchases)
          const levelPurchaseEvent = await this.eventRepository.findOne({
            where: {
              eventName: 'LevelPurchased',
              contract: 'OrbitA',
              transactionHash: txHash,
              levelNumber: Number(level), // Match the level from PaymentSent
            },
          });

          if (levelPurchaseEvent?.eventData?.userID) {
            const purchasingUserId = Number(levelPurchaseEvent.eventData.userID);
            this.logger.log(`  → Found LevelPurchased event for userID: ${purchasingUserId}, level: ${level}`);
            fromUser = await this.userRepository.findOne({
              where: { userId: purchasingUserId },
            });
            if (fromUser) {
              this.logger.log(`  → Found purchasing user: ${fromUser.userId} (DB id: ${fromUser.id})`);
              break;
            }
          }

          // If not found, try UserRegistered event (for registrations)
          if (!fromUser) {
            const registrationEvent = await this.eventRepository.findOne({
              where: {
                eventName: 'UserRegistered',
                contract: 'OrbitA',
                transactionHash: txHash,
              },
            });

            if (registrationEvent?.eventData?.userID) {
              const registeringUserId = Number(registrationEvent.eventData.userID);
              this.logger.log(`  → Found UserRegistered event for userID: ${registeringUserId}`);
              fromUser = await this.userRepository.findOne({
                where: { userId: registeringUserId },
              });
              if (fromUser) {
                this.logger.log(`  → Found registering user: ${fromUser.userId} (DB id: ${fromUser.id})`);
                break;
              }
            }
          }
          
          // Fallback: try to find user by registration_tx_hash (for registrations)
          if (!fromUser) {
            fromUser = await this.userRepository.findOne({
              where: { registrationTxHash: txHash },
            });
            if (fromUser) {
              this.logger.log(`  → Found user via registration_tx_hash: ${fromUser.userId} (DB id: ${fromUser.id})`);
              break;
            }
          }
          
          // If not found, wait a bit and retry (events may be processing in parallel)
          if (!fromUser && attempts < maxAttempts - 1) {
            this.logger.log(`  → Event not found yet (attempt ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
          }
          attempts++;
        }
        
        if (!fromUser) {
          this.logger.warn(`  → Could not find triggering user for tx ${txHash} after ${maxAttempts} attempts`);
        }
      }

      const toUser = await this.userRepository.findOne({ where: { userId: Number(toUserID) } });

      if (!toUser) {
        this.logger.warn(`  → To-User ${toUserID} not found`);
        return;
      }

      // For fallback/admin payments (toUserID=1 or paymentType='fallback'), 
      // we can still save the payment even if we don't know the triggering user
      const isAdminPayment = Number(toUserID) === 1;
      const isFallbackPayment = paymentType.toString() === 'fallback';

      // Check if this is a missed payment scenario
      // If fromUser exists and has a referrer, check if referrer should have received it
      let shouldHaveGoneToUserId: number | null = null;
      
      if (fromUser && fromUser.referrerId) {
        // Check if the referrer has this level active
        const referrerLevel = await this.userLevelRepository.findOne({
          where: {
            userId: fromUser.referrerId,
            orbit: OrbitType.ORBIT_A,
            levelNumber: Number(level),
            isActive: true,
          },
        });

        // If referrer doesn't have the level but payment went to someone else, it's a missed payment
        if (!referrerLevel && toUser.id !== fromUser.referrerId) {
          shouldHaveGoneToUserId = fromUser.referrerId;
          this.logger.log(`  → Detected missed payment: should have gone to referrer (user ${fromUser.referrerId})`);
        }
      }

      // Create payment record
      // Convert BigInt wei amount to decimal string for DECIMAL(36, 18) column
      const amountDecimal = this.weiToDecimal(BigInt(cctAmount.toString()));
      
      const payment = this.paymentRepository.create({
        // fromUserId tracks who triggered the payment (registering user for system payments)
        fromUserId: fromUser?.id || null,
        toUserId: toUser.id,
        shouldHaveGoneToUserId: shouldHaveGoneToUserId,
        orbit: OrbitType.ORBIT_A,
        levelNumber: Number(level),
        amount: amountDecimal,
        paymentType: paymentType.toString(),
        status: shouldHaveGoneToUserId ? PaymentStatus.MISSED : PaymentStatus.RECEIVED,
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp: blockTimestamp,
      });

      await this.paymentRepository.save(payment);

      // Add earnings to recipient's active cycle (only if payment was received, not missed)
      if (payment.status === PaymentStatus.RECEIVED) {
        await this.levelCyclesService.addEarnings(
          toUser.id,
          OrbitType.ORBIT_A,
          Number(level),
          amountDecimal,
        );
      }

      if (shouldHaveGoneToUserId) {
        this.logger.log(`  → Payment recorded (MISSED: should_have_gone_to_user_id: ${shouldHaveGoneToUserId}, to_user_id: ${payment.toUserId})`);
      } else if (isAdminPayment || isFallbackPayment) {
        this.logger.log(`  → Payment recorded (FALLBACK to admin: from_user_id: ${payment.fromUserId || 'unknown'}, to_user_id: ${payment.toUserId}, type: ${paymentType})`);
      } else {
        this.logger.log(`  → Payment recorded (from_user_id: ${payment.fromUserId || 'null'}, to_user_id: ${payment.toUserId})`);
      }

      // Store event
      const eventRecord = this.eventRepository.create({
        eventName: 'PaymentSent',
        contract: 'OrbitA',
        userId: toUser.id,
        levelNumber: Number(level),
        eventData: {
          fromUserID: fromUserID.toString(),
          toUserID: toUserID.toString(),
          level: level.toString(),
          cctAmount: cctAmount.toString(),
          position: position.toString(),
          paymentType: paymentType.toString(),
        },
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp,
        logIndex: this.getLogIndex(event),
      });

      await this.eventRepository.save(eventRecord);

    } catch (error) {
      this.logger.error(`Error processing PaymentSent: ${error.message}`);
    }
  }

  async handleMissedPayment(...args) {
    const event = args[args.length - 1];
    const [missedByUserID, level, receivedByUserID, cctAmount] = args;

    const blockTimestamp = await this.getBlockTimestamp(event);

    this.logger.log(`[OrbitA] MissedPayment: Missed=${missedByUserID}, Received=${receivedByUserID}, Level=${level}, Amount=${cctAmount}`);

    try {
      const missedByUser = await this.userRepository.findOne({ where: { userId: Number(missedByUserID) } });
      
      if (!missedByUser) {
        this.logger.warn(`User ${missedByUserID} not found for MissedPayment`);
        return;
      }

      // receivedByUserID can be 0 when the payment is just marked as missed without going to anyone specific yet
      let receivedByUser = null;
      if (Number(receivedByUserID) > 0) {
        receivedByUser = await this.userRepository.findOne({ where: { userId: Number(receivedByUserID) } });
        if (!receivedByUser) {
          this.logger.warn(`Receiver user ${receivedByUserID} not found for MissedPayment`);
        }
      }

      // If cctAmount is 0, try to find the actual payment amount from PaymentSent event in same transaction
      let actualAmount = Number(cctAmount);
      if (actualAmount === 0) {
        // Look for PaymentSent event in the same transaction for this level
        const paymentSentEvent = await this.eventRepository.findOne({
          where: {
            eventName: 'PaymentSent',
            contract: 'OrbitA',
            transactionHash: this.getTxHash(event),
            levelNumber: Number(level),
          },
        });

        if (paymentSentEvent && paymentSentEvent.eventData?.['cctAmount']) {
          actualAmount = Number(paymentSentEvent.eventData['cctAmount']);
          this.logger.log(`  → Found actual payment amount from PaymentSent: ${actualAmount}`);
        }
      }

      // Create missed payment record if we have an actual payment amount
      if (actualAmount > 0) {
        // Convert BigInt wei amount to decimal string for DECIMAL(36, 18) column
        const amountDecimal = this.weiToDecimal(BigInt(actualAmount.toString()));
        
        // Find who actually received the payment (if receivedByUser not set, check PaymentSent event)
        let toUserId = receivedByUser?.id;
        if (!toUserId && actualAmount > 0) {
          const paymentSentEvent = await this.eventRepository.findOne({
            where: {
              eventName: 'PaymentSent',
              contract: 'OrbitA',
              transactionHash: this.getTxHash(event),
              levelNumber: Number(level),
            },
          });

          if (paymentSentEvent && paymentSentEvent.eventData?.['toUserID']) {
            const actualReceiverUserId = Number(paymentSentEvent.eventData['toUserID']);
            const actualReceiver = await this.userRepository.findOne({ 
              where: { userId: actualReceiverUserId } 
            });
            if (actualReceiver) {
              toUserId = actualReceiver.id;
              this.logger.log(`  → Found actual receiver from PaymentSent: User ${actualReceiverUserId}`);
            }
          }
        }

        // Find who triggered this payment (the user who bought the level/registered)
        let triggeredByUserId: number | null = null;
        const newPlacementEvent = await this.eventRepository.findOne({
          where: {
            eventName: 'NewPlacement',
            contract: 'OrbitA',
            transactionHash: this.getTxHash(event),
            levelNumber: Number(level),
          },
        });

        if (newPlacementEvent && newPlacementEvent.eventData?.['userId']) {
          const triggerUserBlockchainId = Number(newPlacementEvent.eventData['userId']);
          const triggerUser = await this.userRepository.findOne({
            where: { userId: triggerUserBlockchainId },
          });
          if (triggerUser) {
            triggeredByUserId = triggerUser.id;
            this.logger.log(`  → Triggered by User ${triggerUserBlockchainId}`);
          }
        }

        // Determine the reason for missing the payment
        let reason = MissedPaymentReason.LEVEL_NOT_ACTIVATED;
        
        // Check if user has the level activated
        const userLevel = await this.userLevelRepository.findOne({
          where: {
            userId: missedByUser.id,
            orbit: OrbitType.ORBIT_A,
            levelNumber: Number(level),
            isActive: true,
          },
        });

        if (userLevel) {
          // Level is activated but still missed - must be cascade bypass
          reason = MissedPaymentReason.BYPASSED_IN_CASCADE;
        } else if (toUserId === 1) {
          // Went to admin (user id 1 is typically admin)
          reason = MissedPaymentReason.ADMIN_FALLBACK;
        }

        // Create new missed payment record in dedicated table
        const missedPayment = this.missedPaymentRepository.create({
          missedByUserId: missedByUser.id,
          receivedByUserId: toUserId || null,
          triggeredByUserId: triggeredByUserId,
          orbit: OrbitType.ORBIT_A,
          levelNumber: Number(level),
          amount: amountDecimal,
          reason: reason,
          cascadeDepth: 0, // TODO: Track this properly
          transactionHash: this.getTxHash(event),
          blockNumber: this.getBlockNumber(event).toString(),
          blockTimestamp: blockTimestamp,
        });

        await this.missedPaymentRepository.save(missedPayment);
        this.logger.log(`  → Missed payment recorded in dedicated table (amount: ${amountDecimal}, reason: ${reason})`);

        // Also keep legacy record in payments table for backward compatibility
        if (toUserId) {
      const payment = this.paymentRepository.create({
            fromUserId: null,
            toUserId: toUserId,
            shouldHaveGoneToUserId: missedByUser.id,
        orbit: OrbitType.ORBIT_A,
            levelNumber: Number(level),
            amount: amountDecimal,
            paymentType: 'missed',
            status: PaymentStatus.MISSED,
            transactionHash: this.getTxHash(event),
            blockNumber: this.getBlockNumber(event).toString(),
            blockTimestamp: blockTimestamp,
          });

          await this.paymentRepository.save(payment);
        }
      } else {
        this.logger.log(`  → Missed opportunity recorded (no payment amount found)`);
      }

      // Store event
      const eventRecord = this.eventRepository.create({
        eventName: 'MissedPayment',
        contract: 'OrbitA',
        userId: missedByUser.id,
        levelNumber: Number(level),
        eventData: {
          missedByUserID: missedByUserID.toString(),
          level: level.toString(),
          receivedByUserID: receivedByUserID.toString(),
          cctAmount: cctAmount.toString(),
        },
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp,
        logIndex: this.getLogIndex(event),
      });

      await this.eventRepository.save(eventRecord);

    } catch (error) {
      this.logger.error(`Error processing MissedPayment: ${error.message}`);
    }
  }

  async handleRecycled(...args) {
    const event = args[args.length - 1];
    const [rootNodeID, level, newRecycleCount, triggeredByUserID, timestamp] = args;

    const blockTimestamp = await this.getBlockTimestamp(event);

    this.logger.log(`[OrbitA] Recycled: User=${rootNodeID}, Level=${level}, Count=${newRecycleCount}`);

    try {
      const user = await this.userRepository.findOne({ where: { userId: Number(rootNodeID) } });
      
      if (!user) {
        this.logger.warn(`User ${rootNodeID} not found for Recycled`);
        return;
      }

      // Update user level recycle count
      const userLevel = await this.userLevelRepository.findOne({
        where: {
          userId: user.id,
          orbit: OrbitType.ORBIT_A,
          levelNumber: Number(level),
        },
      });

      if (userLevel) {
        userLevel.recycleCount = Number(newRecycleCount);
        userLevel.lastRecycledAt = await this.getBlockTimestamp(event);
        await this.userLevelRepository.save(userLevel);
      }

      // Store event
      const eventRecord = this.eventRepository.create({
        eventName: 'Recycled',
        contract: 'OrbitA',
        userId: user.id,
        levelNumber: Number(level),
        eventData: {
          rootNodeID: rootNodeID.toString(),
          level: level.toString(),
          newRecycleCount: newRecycleCount.toString(),
          triggeredByUserID: triggeredByUserID.toString(),
          timestamp: timestamp.toString(),
        },
        transactionHash: this.getTxHash(event),
        blockNumber: this.getBlockNumber(event).toString(),
        blockTimestamp,
        logIndex: this.getLogIndex(event),
      });

      await this.eventRepository.save(eventRecord);

    } catch (error) {
      this.logger.error(`Error processing Recycled: ${error.message}`);
    }
  }
}
