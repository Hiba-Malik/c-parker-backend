import { DataSource } from 'typeorm';
import { config } from 'dotenv';
import * as path from 'path';

// Load environment variables
config({ path: path.resolve(__dirname, '../../.env') });

async function seedAdmin() {
  // Validate contract configuration
  if (!process.env.ORBIT_A_ADDRESS || !process.env.RPC_URL) {
    console.error('[ERROR] Contract not configured!');
    console.log('\nPlease add to your .env:');
    console.log('ORBIT_A_ADDRESS=0x...');
    console.log('RPC_URL=https://...');
    process.exit(1);
  }

  console.log('[INFO] Fetching admin info from contract...');
  console.log('   Contract:', process.env.ORBIT_A_ADDRESS);
  console.log('   RPC:', process.env.RPC_URL);

  // Initialize database connection
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_DATABASE || 'cparker',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    await dataSource.initialize();
    console.log('[INFO] Database connected');

    // Check if admin already exists
    const existingAdmin = await dataSource.query(
      'SELECT * FROM users WHERE user_id = 1'
    );

    if (existingAdmin.length > 0) {
      console.log('[WARNING] Admin user (ID 1) already exists:');
      console.log('   Internal DB ID:', existingAdmin[0].id);
      console.log('   Wallet:', existingAdmin[0].wallet_address);
      console.log('   Referrer:', existingAdmin[0].referrer_id);
      
      const answer = await askQuestion('Do you want to recreate admin? (yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
        console.log('[INFO] Aborted');
        await dataSource.destroy();
        return;
      }

      // Delete existing admin and related records
      console.log('[INFO] Deleting existing admin and related records...');
      await dataSource.query('DELETE FROM user_levels WHERE user_id = $1', [existingAdmin[0].id]);
      await dataSource.query('DELETE FROM payments WHERE to_user_id = $1 OR from_user_id = $1', [existingAdmin[0].id]);
      await dataSource.query('DELETE FROM missed_payments WHERE missed_by_user_id = $1 OR received_by_user_id = $1', [existingAdmin[0].id]);
      await dataSource.query('DELETE FROM events WHERE user_id = $1', [existingAdmin[0].id]);
      await dataSource.query('DELETE FROM users WHERE id = $1', [existingAdmin[0].id]);
      console.log('[SUCCESS] Deleted existing admin');
    }

    // Fetch admin info from contract
    console.log('\n[INFO] Fetching admin wallet from contract...');
    
    let adminWallet: string = '';
    let deploymentTxHash: string = '0x0000000000000000000000000000000000000000000000000000000000000000';
    let deploymentTimestamp: Date = new Date('2025-01-01T00:00:00Z');

    try {
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
      
      // Import ABI
      const OrbitAABI = require('../src/contracts/abis/OrbitA.json');
      const contract = new ethers.Contract(
        process.env.ORBIT_A_ADDRESS!,
        OrbitAABI,
        provider
      );

      // Get admin address from contract (User ID 1)
      console.log('   → Reading users(1) from contract...');
      const userInfo = await contract.users(1);
      
      if (!userInfo || !userInfo.userAddress) {
        throw new Error('Admin (User ID 1) not found in contract');
      }
      
      adminWallet = userInfo.userAddress;
      console.log('   [SUCCESS] Admin wallet:', adminWallet);

      // Get contract deployment transaction
      console.log('\n[INFO] Fetching contract deployment info...');
      
      // Option 1: Use provided deployment tx from env
      const providedDeploymentTx = process.env.CONTRACT_DEPLOYMENT_TX;
      
      if (providedDeploymentTx) {
        console.log('   → Using deployment tx from env...');
        const receipt = await provider.getTransactionReceipt(providedDeploymentTx);
        if (receipt && receipt.blockNumber) {
          const block = await provider.getBlock(receipt.blockNumber);
          deploymentTimestamp = new Date(block!.timestamp * 1000);
          deploymentTxHash = providedDeploymentTx;
          console.log('   [SUCCESS] Deployment tx:', deploymentTxHash);
          console.log('   [SUCCESS] Deployment time:', deploymentTimestamp);
        } else {
          throw new Error('Could not fetch deployment transaction receipt');
        }
      } else {
        // Option 2: Scan for contract creation transaction
        console.log('   [INFO] Scanning for contract creation (this may take a moment)...');
        
        const contractAddress = process.env.ORBIT_A_ADDRESS!;
        const currentBlock = await provider.getBlockNumber();
        
        // Search backwards from current block (limit to last 10000 blocks for performance)
        const searchLimit = Math.max(0, currentBlock - 10000);
        let found = false;
        
        for (let blockNum = currentBlock; blockNum >= searchLimit; blockNum--) {
          if (blockNum % 1000 === 0) {
            console.log(`      Scanning block ${blockNum}...`);
          }
          
          const block = await provider.getBlock(blockNum, false);
          if (block && block.transactions) {
            for (const txHash of block.transactions) {
              const receipt = await provider.getTransactionReceipt(txHash);
              if (receipt && receipt.contractAddress?.toLowerCase() === contractAddress.toLowerCase()) {
                deploymentTxHash = txHash;
                deploymentTimestamp = new Date(block.timestamp * 1000);
                found = true;
                console.log('   [SUCCESS] Found deployment tx:', deploymentTxHash);
                console.log('   [SUCCESS] Deployment time:', deploymentTimestamp);
                break;
              }
            }
            if (found) break;
          }
        }
        
        if (!found) {
          console.log('   [WARNING] Could not find deployment tx in recent blocks');
          console.log('      Add CONTRACT_DEPLOYMENT_TX to .env for accurate timestamp');
          // Use fallback
          deploymentTxHash = '0x0000000000000000000000000000000000000000000000000000000000000000';
          deploymentTimestamp = new Date('2025-01-01T00:00:00Z');
        }
      }

    } catch (error) {
      console.error('[ERROR] Failed to fetch admin info from contract:', error.message);
      console.log('\nMake sure:');
      console.log('1. RPC_URL is correct and accessible');
      console.log('2. ORBIT_A_ADDRESS is the correct deployed contract');
      console.log('3. Contract has User ID 1 registered (admin)');
      await dataSource.destroy();
      process.exit(1);
    }

    // Insert admin user
    console.log('\n[INFO] Creating admin user in database...');
    await dataSource.query(
      `
      INSERT INTO users (
        user_id,
        wallet_address,
        referrer_id,
        registered_at,
        registration_tx_hash,
        created_at,
        updated_at
      ) VALUES ($1, $2, NULL, $3, $4, NOW(), NOW())
      `,
      [1, adminWallet, deploymentTimestamp, deploymentTxHash]
    );

    // Get admin's internal DB ID
    const admin = await dataSource.query('SELECT * FROM users WHERE user_id = 1');
    const adminInternalId = admin[0].id;
    
    console.log('[SUCCESS] Admin user created!');
    console.log('   Internal DB ID:', adminInternalId);

    // Create all 20 level records for admin (10 Orbit A + 10 Orbit B)
    console.log('\n[INFO] Activating all 20 levels for admin...');
    
    // Orbit A levels (1-10)
    for (let level = 1; level <= 10; level++) {
      await dataSource.query(
        `
        INSERT INTO user_levels (
          user_id,
          orbit,
          level_number,
          is_active,
          activated_at,
          activation_tx_hash,
          upline_id,
          position_in_upline,
          recycle_count,
          created_at,
          updated_at
        ) VALUES ($1, 'ORBIT_A', $2, true, $3, $4, NULL, NULL, 0, NOW(), NOW())
        `,
        [adminInternalId, level, deploymentTimestamp, deploymentTxHash]
      );
    }
    console.log('   [SUCCESS] Activated Orbit A levels 1-10');

    // Orbit B levels (1-10)
    for (let level = 1; level <= 10; level++) {
      await dataSource.query(
        `
        INSERT INTO user_levels (
          user_id,
          orbit,
          level_number,
          is_active,
          activated_at,
          activation_tx_hash,
          upline_id,
          position_in_upline,
          recycle_count,
          created_at,
          updated_at
        ) VALUES ($1, 'ORBIT_B', $2, true, $3, $4, NULL, NULL, 0, NOW(), NOW())
        `,
        [adminInternalId, level, deploymentTimestamp, deploymentTxHash]
      );
    }
    console.log('   [SUCCESS] Activated Orbit B levels 1-10');

    // Verify level count
    const levelCount = await dataSource.query(
      'SELECT COUNT(*) as count FROM user_levels WHERE user_id = $1',
      [adminInternalId]
    );
    
    console.log('\n[SUCCESS] Admin setup complete!');
    console.log('=======================================');
    console.log('Internal DB ID:', admin[0].id);
    console.log('Blockchain User ID: 1');
    console.log('Wallet Address:', admin[0].wallet_address);
    console.log('Referrer ID:', admin[0].referrer_id || 'NULL (no referrer)');
    console.log('Registered At:', admin[0].registered_at);
    console.log('Tx Hash:', admin[0].registration_tx_hash);
    console.log('Active Levels:', levelCount[0].count, '/ 20');
    console.log('=======================================');

    await dataSource.destroy();
    console.log('\n[INFO] Done!');
  } catch (error) {
    console.error('[ERROR]', error.message);
    await dataSource.destroy();
    process.exit(1);
  }
}

function askQuestion(question: string): Promise<string> {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(question, (answer: string) => {
      readline.close();
      resolve(answer);
    });
  });
}

// Run
seedAdmin();

