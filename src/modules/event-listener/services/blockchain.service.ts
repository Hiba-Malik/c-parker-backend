import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import OrbitAABI from '../../../contracts/abis/OrbitA.json';
import OrbitBABI from '../../../contracts/abis/OrbitB.json';

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.Provider;
  private orbitAContract: ethers.Contract;
  private orbitBContract: ethers.Contract;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Don't auto-initialize, let EventListenerService control this
  }

  async initialize() {
    try {
      const providerUrl = this.getProviderUrl();
      this.provider = new ethers.JsonRpcProvider(providerUrl);

      // Suppress "filter not found" errors - these are normal when filters expire
      // Ethers will automatically recreate filters as needed
      (this.provider as any)._events = (this.provider as any)._events || {};
      const originalEmit = this.provider.emit.bind(this.provider);
      this.provider.emit = (eventName: any, ...args: any[]) => {
        // Suppress filter-related errors
        if (eventName === 'error') {
          const error = args[0];
          if (error?.error?.message === 'filter not found' || 
              error?.shortMessage === 'could not coalesce error') {
            // Silently ignore - this is expected behavior when filters expire
            return false;
          }
        }
        return originalEmit(eventName, ...args);
      };

      // Test connection
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      this.logger.log(`Connected to ${network.name} (chainId: ${network.chainId}), block: ${blockNumber}`);

      // Initialize contracts
      const orbitAAddress = this.configService.get('ORBIT_A_ADDRESS');
      const orbitBAddress = this.configService.get('ORBIT_B_ADDRESS');

      if (!orbitAAddress || !orbitBAddress) {
        throw new Error('Contract addresses not configured');
      }

      this.orbitAContract = new ethers.Contract(
        orbitAAddress,
        OrbitAABI,
        this.provider,
      );

      this.orbitBContract = new ethers.Contract(
        orbitBAddress,
        OrbitBABI,
        this.provider,
      );

      this.logger.log('Blockchain service initialized with filter error suppression');

    } catch (error) {
      this.logger.error('Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  getOrbitAContract(): ethers.Contract {
    if (!this.orbitAContract) {
      throw new Error('OrbitA contract not initialized');
    }
    return this.orbitAContract;
  }

  getOrbitBContract(): ethers.Contract {
    if (!this.orbitBContract) {
      throw new Error('OrbitB contract not initialized');
    }
    return this.orbitBContract;
  }

  getProvider(): ethers.Provider {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    return this.provider;
  }

  async getBlock(blockNumber: number) {
    return this.provider.getBlock(blockNumber);
  }

  async getBlockTimestamp(blockNumber: number): Promise<Date> {
    const block = await this.getBlock(blockNumber);
    return new Date(block.timestamp * 1000);
  }

  async removeAllListeners() {
    if (this.orbitAContract) {
      this.orbitAContract.removeAllListeners();
    }
    if (this.orbitBContract) {
      this.orbitBContract.removeAllListeners();
    }
  }

  private getProviderUrl(): string {
    const rpcUrl = this.configService.get('RPC_URL');
    
    if (!rpcUrl) {
      throw new Error('RPC_URL not configured in .env file');
    }

    return rpcUrl;
  }

  getStatus() {
    return {
      isInitialized: !!this.provider,
      network: this.configService.get('NETWORK'),
      orbitA: this.configService.get('ORBIT_A_ADDRESS'),
      orbitB: this.configService.get('ORBIT_B_ADDRESS'),
    };
  }

  /**
   * Get the USD price for a specific level
   * @param level Level number (1-10)
   * @param orbit 'ORBIT_A' or 'ORBIT_B'
   * @returns USD price as a decimal string
   */
  async getLevelPriceInUSD(level: number, orbit: 'ORBIT_A' | 'ORBIT_B'): Promise<string> {
    try {
      const contract = orbit === 'ORBIT_A' ? this.orbitAContract : this.orbitBContract;
      
      if (!contract) {
        // If contract not initialized (listeners disabled), use hardcoded prices
        return this.getHardcodedPrice(level);
      }

      // Get USD price from contract (returns in wei format with 18 decimals)
      const priceInUSD = await contract.getLevelPriceUSD(level);
      
      // Convert from wei (18 decimals) to readable format
      const divisor = BigInt('1000000000000000000'); // 10^18
      const wholePart = priceInUSD / divisor;
      const remainder = priceInUSD % divisor;
      const remainderStr = remainder.toString().padStart(18, '0').substring(0, 2); // Keep only 2 decimal places
      
      return `${wholePart}.${remainderStr}`;
    } catch (error) {
      this.logger.warn(`Failed to fetch price from contract for level ${level}: ${error.message}`);
      // Fallback to hardcoded prices
      return this.getHardcodedPrice(level);
    }
  }

  /**
   * Get the required CCT amount for a specific level
   * @param level Level number (1-10)
   * @param orbit 'ORBIT_A' or 'ORBIT_B'
   * @returns CCT amount as a decimal string
   */
  async getRequiredCCTForLevel(level: number, orbit: 'ORBIT_A' | 'ORBIT_B'): Promise<string> {
    try {
      const contract = orbit === 'ORBIT_A' ? this.orbitAContract : this.orbitBContract;
      
      if (!contract) {
        // If contract not initialized, calculate based on hardcoded USD price
        const usdPrice = this.getHardcodedPrice(level);
        return (parseFloat(usdPrice) * 2).toString(); // Assuming 1 CCT = $0.50 (adjust as needed)
      }

      const cctAmount = await contract.getRequiredCCTForLevel(level);
      
      // Convert from wei to ether (18 decimals) and format nicely
      const divisor = BigInt('1000000000000000000'); // 10^18
      const wholePart = cctAmount / divisor;
      const remainder = cctAmount % divisor;
      const remainderStr = remainder.toString().padStart(18, '0').substring(0, 2); // Keep 2 decimal places
      
      return `${wholePart}.${remainderStr}`;
    } catch (error) {
      this.logger.warn(`Failed to fetch CCT amount from contract for level ${level}: ${error.message}`);
      // Fallback calculation
      const usdPrice = this.getHardcodedPrice(level);
      return (parseFloat(usdPrice) * 2).toString();
    }
  }

  /**
   * Get current CCT price in USD
   * @returns CCT price in USD as a decimal string
   */
  async getCurrentCCTPrice(): Promise<string> {
    try {
      if (!this.orbitAContract) {
        return '0.50'; // Default fallback price
      }

      const cctPrice = await this.orbitAContract.getCurrentCCTPrice();
      
      // Convert from wei (18 decimals) to readable format
      const divisor = BigInt('1000000000000000000'); // 10^18
      const wholePart = cctPrice / divisor;
      const remainder = cctPrice % divisor;
      const remainderStr = remainder.toString().padStart(18, '0').substring(0, 6); // Keep 6 decimal places for price
      
      return `${wholePart}.${remainderStr}`;
    } catch (error) {
      this.logger.warn(`Failed to fetch CCT price: ${error.message}`);
      return '0.50'; // Fallback price
    }
  }

  /**
   * Hardcoded level prices as fallback (in USD)
   */
  private getHardcodedPrice(level: number): string {
    const prices: Record<number, string> = {
      1: '50',
      2: '100',
      3: '200',
      4: '400',
      5: '800',
      6: '1600',
      7: '3200',
      8: '6400',
      9: '12800',
      10: '25600',
    };
    
    return prices[level] || '50';
  }
}

