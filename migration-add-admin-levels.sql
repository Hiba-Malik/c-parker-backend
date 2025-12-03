-- ============================================
-- Migration: Add Admin User Levels
-- ============================================
-- 
-- This migration adds all 20 level records for admin (User ID 1) if they don't exist.
-- Run this if you already have admin user in the database but missing their level records.
--
-- WHY IS THIS NEEDED?
-- The admin user (User ID 1) is initialized in the contract constructor with ALL levels
-- active from the start. However, older databases may have been created before we added
-- automatic level seeding to the seed-admin.ts script.
--
-- WHAT THIS DOES:
-- - Checks if admin user exists (user_id = 1)
-- - Adds missing Orbit A levels (1-10)
-- - Adds missing Orbit B levels (1-10)
-- - All levels set as active with proper timestamps
-- - Skips levels that already exist
--
-- HOW TO RUN:
-- Method 1: Using npm script (recommended)
--   npm run migration:admin-levels
--
-- Method 2: Using shell script directly
--   ./apply-admin-levels-migration.sh
--
-- Method 3: Using psql directly
--   psql -h localhost -U postgres -d cparker -f migration-add-admin-levels.sql
--
-- ============================================

-- ============================================
-- Check if admin exists
-- ============================================

DO $$
DECLARE
    admin_internal_id INTEGER;
    admin_wallet VARCHAR(42);
    admin_registered_at TIMESTAMP;
    admin_tx_hash VARCHAR(66);
    level_num INTEGER;
BEGIN
    -- Get admin's internal ID
    SELECT id, wallet_address, registered_at, registration_tx_hash 
    INTO admin_internal_id, admin_wallet, admin_registered_at, admin_tx_hash
    FROM users 
    WHERE user_id = 1;

    -- Check if admin exists
    IF admin_internal_id IS NULL THEN
        RAISE NOTICE 'Admin user (user_id = 1) not found. Please run: npm run seed:admin';
        RETURN;
    END IF;

    RAISE NOTICE 'Found admin user (internal ID: %, wallet: %)', admin_internal_id, admin_wallet;

    -- ============================================
    -- Add Orbit A Levels (1-10)
    -- ============================================
    
    RAISE NOTICE 'Checking Orbit A levels...';
    
    FOR level_num IN 1..10 LOOP
        -- Check if level already exists
        IF NOT EXISTS (
            SELECT 1 FROM user_levels 
            WHERE user_id = admin_internal_id 
            AND orbit = 'ORBIT_A' 
            AND level_number = level_num
        ) THEN
            -- Insert the level
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
            ) VALUES (
                admin_internal_id,
                'ORBIT_A',
                level_num,
                true,
                admin_registered_at,
                admin_tx_hash,
                NULL,  -- Admin has no upline
                NULL,  -- Admin has no position
                0,
                NOW(),
                NOW()
            );
            
            RAISE NOTICE '  ✓ Added Orbit A Level %', level_num;
        ELSE
            RAISE NOTICE '  → Orbit A Level % already exists', level_num;
        END IF;
    END LOOP;

    -- ============================================
    -- Add Orbit B Levels (1-10)
    -- ============================================
    
    RAISE NOTICE 'Checking Orbit B levels...';
    
    FOR level_num IN 1..10 LOOP
        -- Check if level already exists
        IF NOT EXISTS (
            SELECT 1 FROM user_levels 
            WHERE user_id = admin_internal_id 
            AND orbit = 'ORBIT_B' 
            AND level_number = level_num
        ) THEN
            -- Insert the level
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
            ) VALUES (
                admin_internal_id,
                'ORBIT_B',
                level_num,
                true,
                admin_registered_at,
                admin_tx_hash,
                NULL,  -- Admin has no upline
                NULL,  -- Admin has no position
                0,
                NOW(),
                NOW()
            );
            
            RAISE NOTICE '  ✓ Added Orbit B Level %', level_num;
        ELSE
            RAISE NOTICE '  → Orbit B Level % already exists', level_num;
        END IF;
    END LOOP;

    -- ============================================
    -- Verify Results
    -- ============================================
    
    DECLARE
        orbit_a_count INTEGER;
        orbit_b_count INTEGER;
    BEGIN
        SELECT COUNT(*) INTO orbit_a_count 
        FROM user_levels 
        WHERE user_id = admin_internal_id AND orbit = 'ORBIT_A';
        
        SELECT COUNT(*) INTO orbit_b_count 
        FROM user_levels 
        WHERE user_id = admin_internal_id AND orbit = 'ORBIT_B';
        
        RAISE NOTICE '';
        RAISE NOTICE '=======================================';
        RAISE NOTICE 'Migration Complete!';
        RAISE NOTICE '=======================================';
        RAISE NOTICE 'Admin Internal ID: %', admin_internal_id;
        RAISE NOTICE 'Orbit A Levels: % / 10', orbit_a_count;
        RAISE NOTICE 'Orbit B Levels: % / 10', orbit_b_count;
        RAISE NOTICE 'Total Levels: % / 20', orbit_a_count + orbit_b_count;
        RAISE NOTICE '=======================================';
    END;

END $$;

-- Show final state
SELECT 
    u.user_id,
    u.wallet_address,
    COUNT(CASE WHEN ul.orbit = 'ORBIT_A' THEN 1 END) as orbit_a_levels,
    COUNT(CASE WHEN ul.orbit = 'ORBIT_B' THEN 1 END) as orbit_b_levels,
    COUNT(*) as total_levels
FROM users u
LEFT JOIN user_levels ul ON u.id = ul.user_id
WHERE u.user_id = 1
GROUP BY u.user_id, u.wallet_address;

