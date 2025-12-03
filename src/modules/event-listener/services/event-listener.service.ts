import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { OrbitAProcessor } from '../processors/orbit-a.processor';
import { OrbitBProcessor } from '../processors/orbit-b.processor';

@Injectable()
export class EventListenerService implements OnModuleInit {
  private readonly logger = new Logger(EventListenerService.name);
  private isListening = false;

  constructor(
    private configService: ConfigService,
    private blockchainService: BlockchainService,
    private orbitAProcessor: OrbitAProcessor,
    private orbitBProcessor: OrbitBProcessor,
  ) {}

  async onModuleInit() {
    const enabled = this.configService.get('ENABLE_EVENT_LISTENER') === 'true';
    
    if (enabled) {
      await this.start();
    } else {
      this.logger.warn('Event listener disabled in config');
    }
  }

  async start() {
    if (this.isListening) {
      this.logger.warn('Event listener already running');
      return;
    }

    try {
      // Initialize blockchain connection
      await this.blockchainService.initialize();

      // Start listening to Orbit A events
      await this.setupOrbitAListeners();

      // Start listening to Orbit B events
      await this.setupOrbitBListeners();

      this.isListening = true;
      this.logger.log('Event listeners started successfully');

    } catch (error) {
      this.logger.error('Failed to start event listeners:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isListening) {
      return;
    }

    await this.blockchainService.removeAllListeners();
    this.isListening = false;
    this.logger.log('Event listeners stopped');
  }

  private async setupOrbitAListeners() {
    const contract = this.blockchainService.getOrbitAContract();

    // UserRegistered
    contract.on('UserRegistered', async (userID, userAddress, referrerID, cctAmount, timestamp, event) => {
      try {
        await this.orbitAProcessor.handleUserRegistered(userID, userAddress, referrerID, cctAmount, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling UserRegistered event: ${error.message}`);
      }
    });

    // DualOrbitRegistration
    contract.on('DualOrbitRegistration', async (userID, userAddress, totalCCT, orbitACCT, orbitBCCT, timestamp, event) => {
      try {
        await this.orbitAProcessor.handleDualOrbitRegistration(userID, userAddress, totalCCT, orbitACCT, orbitBCCT, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling DualOrbitRegistration event: ${error.message}`);
      }
    });

    // LevelPurchased
    contract.on('LevelPurchased', async (userID, level, cctAmount, timestamp, event) => {
      try {
        await this.orbitAProcessor.handleLevelPurchased(userID, level, cctAmount, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling LevelPurchased event: ${error.message}`);
      }
    });

    // NewPlacement
    contract.on('NewPlacement', async (userID, uplineID, level, position, timestamp, event) => {
      try {
        await this.orbitAProcessor.handleNewPlacement(userID, uplineID, level, position, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling NewPlacement event: ${error.message}`);
      }
    });

    // PaymentSent
    contract.on('PaymentSent', async (fromUserID, toUserID, level, cctAmount, position, paymentType, event) => {
      try {
        await this.orbitAProcessor.handlePaymentSent(fromUserID, toUserID, level, cctAmount, position, paymentType, event);
      } catch (error) {
        this.logger.error(`Error handling PaymentSent event: ${error.message}`);
      }
    });

    // MissedPayment
    contract.on('MissedPayment', async (missedByUserID, level, receivedByUserID, cctAmount, event) => {
      try {
        await this.orbitAProcessor.handleMissedPayment(missedByUserID, level, receivedByUserID, cctAmount, event);
      } catch (error) {
        this.logger.error(`Error handling MissedPayment event: ${error.message}`);
      }
    });

    // Recycled
    contract.on('Recycled', async (rootNodeID, level, newRecycleCount, triggeredByUserID, timestamp, event) => {
      try {
        await this.orbitAProcessor.handleRecycled(rootNodeID, level, newRecycleCount, triggeredByUserID, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling Recycled event: ${error.message}`);
      }
    });
  }

  private async setupOrbitBListeners() {
    const contract = this.blockchainService.getOrbitBContract();

    // OrbitBActivated
    contract.on('OrbitBActivated', async (userID, userAddress, referrerID, cctAmount, timestamp, event) => {
      try {
        await this.orbitBProcessor.handleOrbitBActivated(userID, userAddress, referrerID, cctAmount, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling OrbitBActivated event: ${error.message}`);
      }
    });

    // LevelPurchased
    contract.on('LevelPurchased', async (userID, level, cctAmount, timestamp, event) => {
      try {
        await this.orbitBProcessor.handleLevelPurchased(userID, level, cctAmount, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling LevelPurchased event: ${error.message}`);
      }
    });

    // NewPlacement
    contract.on('NewPlacement', async (userID, uplineID, level, position, timestamp, event) => {
      try {
        await this.orbitBProcessor.handleNewPlacement(userID, uplineID, level, position, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling NewPlacement event: ${error.message}`);
      }
    });

    // PaymentSent
    contract.on('PaymentSent', async (fromUserID, toUserID, level, cctAmount, position, paymentType, event) => {
      try {
        await this.orbitBProcessor.handlePaymentSent(fromUserID, toUserID, level, cctAmount, position, paymentType, event);
      } catch (error) {
        this.logger.error(`Error handling PaymentSent event: ${error.message}`);
      }
    });

    // MissedPayment
    contract.on('MissedPayment', async (missedByUserID, level, receivedByUserID, cctAmount, position, event) => {
      try {
        await this.orbitBProcessor.handleMissedPayment(missedByUserID, level, receivedByUserID, cctAmount, position, event);
      } catch (error) {
        this.logger.error(`Error handling MissedPayment event: ${error.message}`);
      }
    });

    // Recycled
    contract.on('Recycled', async (rootNodeID, level, newRecycleCount, triggeredByUserID, timestamp, event) => {
      try {
        await this.orbitBProcessor.handleRecycled(rootNodeID, level, newRecycleCount, triggeredByUserID, timestamp, event);
      } catch (error) {
        this.logger.error(`Error handling Recycled event: ${error.message}`);
      }
    });
  }

  getStatus() {
    return {
      isListening: this.isListening,
      network: this.configService.get('NETWORK'),
      orbitA: this.configService.get('ORBIT_A_ADDRESS'),
      orbitB: this.configService.get('ORBIT_B_ADDRESS'),
    };
  }
}
