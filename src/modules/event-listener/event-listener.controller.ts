import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { EventListenerService } from './services/event-listener.service';
import { BlockchainService } from './services/blockchain.service';

@ApiTags('debug')
@Controller('debug')
export class EventListenerController {
  constructor(
    private eventListenerService: EventListenerService,
    private blockchainService: BlockchainService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Check event listener status' })
  @ApiResponse({ status: 200, description: 'Event listener status' })
  async getStatus() {
    const listenerStatus = this.eventListenerService.getStatus();
    const blockchainStatus = this.blockchainService.getStatus();

    return {
      eventListener: listenerStatus,
      blockchain: blockchainStatus,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-connection')
  @ApiOperation({ summary: 'Test blockchain connection' })
  @ApiResponse({ status: 200, description: 'Connection test results' })
  async testConnection() {
    try {
      const provider = this.blockchainService.getProvider();
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      const block = await provider.getBlock(blockNumber);

      return {
        success: true,
        network: {
          name: network.name,
          chainId: network.chainId.toString(),
        },
        currentBlock: blockNumber,
        blockTimestamp: new Date(block.timestamp * 1000).toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('test-contract')
  @ApiOperation({ summary: 'Test if contracts are deployed' })
  @ApiResponse({ status: 200, description: 'Contract deployment status' })
  async testContract() {
    try {
      const provider = this.blockchainService.getProvider();
      const orbitAContract = this.blockchainService.getOrbitAContract();
      const orbitBContract = this.blockchainService.getOrbitBContract();

      const orbitAAddress = await orbitAContract.getAddress();
      const orbitBAddress = await orbitBContract.getAddress();

      // Check if there's bytecode at these addresses
      const orbitACode = await provider.getCode(orbitAAddress);
      const orbitBCode = await provider.getCode(orbitBAddress);

      const orbitADeployed = orbitACode !== '0x';
      const orbitBDeployed = orbitBCode !== '0x';

      let contractData = null;
      
      if (orbitADeployed) {
        try {
          const lastUserID = await orbitAContract.lastUserID();
          const totalUsers = await orbitAContract.getTotalUsers();
          contractData = {
            lastUserID: lastUserID.toString(),
            totalUsers: totalUsers.toString(),
          };
        } catch (err) {
          contractData = { error: 'Contract deployed but function calls failed', details: err.message };
        }
      }
      
      return {
        success: true,
        orbitA: {
          address: orbitAAddress,
          hasCode: orbitADeployed,
          codeLength: orbitACode.length,
          isDeployed: orbitADeployed,
          data: contractData,
        },
        orbitB: {
          address: orbitBAddress,
          hasCode: orbitBDeployed,
          codeLength: orbitBCode.length,
          isDeployed: orbitBDeployed,
        },
        diagnosis: orbitADeployed 
          ? '[SUCCESS] Contract exists at this address' 
          : '[ERROR] NO CONTRACT at this address! Wrong address in .env or not deployed.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }

  @Get('query-past-events')
  @ApiOperation({ summary: 'Query past events from blockchain' })
  @ApiQuery({ name: 'fromBlock', required: false, description: 'Starting block number' })
  @ApiQuery({ name: 'toBlock', required: false, description: 'Ending block number (default: latest)' })
  @ApiResponse({ status: 200, description: 'Past events' })
  async queryPastEvents(
    @Query('fromBlock') fromBlock?: string,
    @Query('toBlock') toBlock?: string,
  ) {
    try {
      const provider = this.blockchainService.getProvider();
      const orbitAContract = this.blockchainService.getOrbitAContract();
      
      const latestBlock = await provider.getBlockNumber();
      const to = toBlock ? parseInt(toBlock) : latestBlock;
      // Alchemy free tier: max 10 blocks per query
      const from = fromBlock ? parseInt(fromBlock) : to - 9;

      // Query UserRegistered events
      const userRegisteredFilter = orbitAContract.filters.UserRegistered();
      const userRegisteredEvents = await orbitAContract.queryFilter(
        userRegisteredFilter,
        from,
        to,
      );

      // Query DualOrbitRegistration events
      const dualOrbitFilter = orbitAContract.filters.DualOrbitRegistration();
      const dualOrbitEvents = await orbitAContract.queryFilter(
        dualOrbitFilter,
        from,
        to,
      );

      return {
        success: true,
        blockRange: { 
          from,
          to,
          latest: latestBlock,
          note: 'Alchemy free tier limits queries to 10 blocks. Specify fromBlock and toBlock for specific range.'
        },
        eventsFound: {
          UserRegistered: userRegisteredEvents.length,
          DualOrbitRegistration: dualOrbitEvents.length,
        },
        events: {
          UserRegistered: userRegisteredEvents.map(e => {
            const eventLog = e as any;
            return {
              blockNumber: e.blockNumber,
              transactionHash: e.transactionHash,
              args: {
                userID: eventLog.args?.userID?.toString(),
                userAddress: eventLog.args?.userAddress,
                referrerID: eventLog.args?.referrerID?.toString(),
                cctAmount: eventLog.args?.cctAmount?.toString(),
                timestamp: eventLog.args?.timestamp?.toString(),
              },
            };
          }),
          DualOrbitRegistration: dualOrbitEvents.map(e => {
            const eventLog = e as any;
            return {
              blockNumber: e.blockNumber,
              transactionHash: e.transactionHash,
              args: {
                userID: eventLog.args?.userID?.toString(),
                userAddress: eventLog.args?.userAddress,
                totalCCT: eventLog.args?.totalCCT?.toString(),
              },
            };
          }),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stack: error.stack,
      };
    }
  }
}






