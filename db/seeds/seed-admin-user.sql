-- Seed Admin User (Blockchain User ID 1)
-- This script sets up the admin user properly with no referrer

-- IMPORTANT: Update these values before running:
-- 1. Replace ADMIN_WALLET_ADDRESS with actual admin wallet
-- 2. Replace ADMIN_TX_HASH with actual registration transaction hash
-- 3. Replace ADMIN_TIMESTAMP with actual registration timestamp

-- Delete existing admin user if exists (for re-seeding)
DELETE FROM user_levels WHERE user_id = (SELECT id FROM users WHERE user_id = 1);
DELETE FROM payments WHERE to_user_id = (SELECT id FROM users WHERE user_id = 1) OR from_user_id = (SELECT id FROM users WHERE user_id = 1);
DELETE FROM missed_payments WHERE missed_by_user_id = (SELECT id FROM users WHERE user_id = 1) OR received_by_user_id = (SELECT id FROM users WHERE user_id = 1);
DELETE FROM events WHERE user_id = (SELECT id FROM users WHERE user_id = 1);
DELETE FROM users WHERE user_id = 1;

-- Insert admin user
-- NOTE: You must update these values!
INSERT INTO users (
  user_id,
  wallet_address,
  referrer_id,
  registered_at,
  registration_tx_hash,
  created_at,
  updated_at
) VALUES (
  1,                                                          -- Blockchain User ID 1 (admin)
  'ADMIN_WALLET_ADDRESS',                                     -- Replace with actual admin wallet
  NULL,                                                       -- Admin has no referrer
  'ADMIN_TIMESTAMP',                                          -- Replace with actual timestamp (e.g., '2025-01-01 00:00:00')
  'ADMIN_TX_HASH',                                            -- Replace with actual tx hash
  NOW(),
  NOW()
);

-- Verify admin was created
SELECT 
  id as internal_id,
  user_id as blockchain_id,
  wallet_address,
  referrer_id,
  registered_at,
  registration_tx_hash
FROM users 
WHERE user_id = 1;

-- Show message
DO $$ 
BEGIN 
  RAISE NOTICE '[SUCCESS] Admin user created successfully!';
  RAISE NOTICE 'Internal DB ID: %', (SELECT id FROM users WHERE user_id = 1);
  RAISE NOTICE 'Blockchain User ID: 1';
  RAISE NOTICE 'Referrer: NULL (no referrer)';
END $$;

