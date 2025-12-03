-- ============================================
-- OPTIMIZED C-PARKER DATABASE SCHEMA
-- PostgreSQL - Normalized, No Redundant Data
-- ============================================

-- Drop existing tables if recreating
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS missed_payments CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS level_cycles CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS user_levels CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS missed_payment_reason CASCADE;
DROP TYPE IF EXISTS orbit_type CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE orbit_type AS ENUM ('ORBIT_A', 'ORBIT_B');

CREATE TYPE payment_status AS ENUM ('RECEIVED', 'MISSED');

CREATE TYPE missed_payment_reason AS ENUM (
  'LEVEL_NOT_ACTIVATED',     -- User hasn't purchased this level yet
  'BYPASSED_IN_CASCADE',     -- User was bypassed during upline cascade
  'ADMIN_FALLBACK'           -- Payment went to admin (no eligible upline)
);

-- ============================================
-- USERS TABLE
-- Core user data only, everything else calculated
-- ============================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  
  -- From blockchain
  user_id INTEGER UNIQUE NOT NULL, -- Blockchain ID (1, 2, 3...)
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  referrer_id INTEGER REFERENCES users(id), -- Their referrer (NULL for admin)
  
  -- Registration data
  registered_at TIMESTAMP NOT NULL, -- From blockchain event timestamp
  registration_tx_hash VARCHAR(66) NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_referrer ON users(referrer_id);
CREATE INDEX idx_users_user_id ON users(user_id);
CREATE INDEX idx_users_registered ON users(registered_at);

-- IMPORTANT: Admin user (user_id = 1) must be created first
-- Admin has referrer_id = NULL (no referrer)
-- Run: npm run seed:admin to create the admin user

-- ============================================
-- USER LEVELS
-- Tracks which levels are active per user per orbit
-- ============================================

CREATE TABLE user_levels (
  id SERIAL PRIMARY KEY,
  
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orbit orbit_type NOT NULL,
  level_number INTEGER NOT NULL CHECK (level_number >= 1 AND level_number <= 10),
  
  -- Activation
  is_active BOOLEAN DEFAULT FALSE,
  activated_at TIMESTAMP,
  activation_tx_hash VARCHAR(66),
  
  -- Matrix position (from NewPlacement event)
  upline_id INTEGER REFERENCES users(id), -- Who is above them
  position_in_upline INTEGER, -- Position 1-4 (Orbit A) or 1-6 (Orbit B)
  
  -- Recycle tracking
  recycle_count INTEGER DEFAULT 0,
  last_recycled_at TIMESTAMP,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, orbit, level_number)
);

CREATE INDEX idx_user_levels_user ON user_levels(user_id);
CREATE INDEX idx_user_levels_orbit ON user_levels(orbit);
CREATE INDEX idx_user_levels_active ON user_levels(is_active);
CREATE INDEX idx_user_levels_upline ON user_levels(upline_id);
CREATE INDEX idx_user_levels_combo ON user_levels(user_id, orbit, level_number);

-- ============================================
-- PAYMENTS
-- All payment events (received and missed)
-- ============================================

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  
  -- Payment flow
  from_user_id INTEGER REFERENCES users(id), -- Who triggered the payment
  to_user_id INTEGER NOT NULL REFERENCES users(id), -- Who received it
  
  -- Context
  orbit orbit_type NOT NULL,
  level_number INTEGER NOT NULL,
  
  -- Amount & status
  amount DECIMAL(36, 18) NOT NULL,
  status payment_status NOT NULL,
  
  -- Payment type from event ('direct', 'cascade', 'missed', 'position4', 'position6', etc.)
  payment_type VARCHAR(50),
  
  -- If status=MISSED, who should have received it but didn't
  -- (Can be different from to_user_id after 9-hop search)
  should_have_gone_to_user_id INTEGER REFERENCES users(id),
  
  -- Blockchain data
  transaction_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMP NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_payments_to_user ON payments(to_user_id);
CREATE INDEX idx_payments_from_user ON payments(from_user_id);
CREATE INDEX idx_payments_missed_by ON payments(should_have_gone_to_user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_timestamp ON payments(block_timestamp DESC);
CREATE INDEX idx_payments_orbit_level ON payments(orbit, level_number);
CREATE INDEX idx_payments_tx ON payments(transaction_hash);

-- ============================================
-- MISSED PAYMENTS
-- Dedicated table for tracking missed payment opportunities with full context
-- ============================================

CREATE TABLE missed_payments (
  id SERIAL PRIMARY KEY,
  
  -- Who missed the payment
  missed_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Who actually received the payment (NULL if went to admin/lost)
  received_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Which referral triggered this payment (the person who bought the level)
  triggered_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Level details
  orbit orbit_type NOT NULL,
  level_number INTEGER NOT NULL CHECK (level_number >= 1 AND level_number <= 10),
  
  -- Payment amount (in wei, DECIMAL for precision)
  amount DECIMAL(36, 18) NOT NULL,
  
  -- Why was it missed?
  reason missed_payment_reason NOT NULL,
  
  -- How many levels did it cascade up? (0 = direct bypass, 1+ = cascaded)
  cascade_depth INTEGER DEFAULT 0,
  
  -- Blockchain data
  transaction_hash VARCHAR(66) NOT NULL,
  block_number VARCHAR(20) NOT NULL,
  block_timestamp TIMESTAMP NOT NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint
  CONSTRAINT unique_missed_payment UNIQUE (transaction_hash, missed_by_user_id, level_number, orbit)
);

CREATE INDEX idx_missed_payments_missed_by ON missed_payments(missed_by_user_id);
CREATE INDEX idx_missed_payments_received_by ON missed_payments(received_by_user_id);
CREATE INDEX idx_missed_payments_triggered_by ON missed_payments(triggered_by_user_id);
CREATE INDEX idx_missed_payments_level ON missed_payments(orbit, level_number);
CREATE INDEX idx_missed_payments_timestamp ON missed_payments(block_timestamp DESC);
CREATE INDEX idx_missed_payments_tx ON missed_payments(transaction_hash);

-- ============================================
-- LEVEL CYCLES
-- Tracks each cycle completion for users
-- ============================================

CREATE TABLE level_cycles (
  id SERIAL PRIMARY KEY,
  
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  orbit orbit_type NOT NULL,
  level_number INTEGER NOT NULL CHECK (level_number >= 1 AND level_number <= 10),
  
  -- Cycle tracking
  cycle_number INTEGER NOT NULL, -- 1, 2, 3, etc.
  
  -- Timestamps
  started_at TIMESTAMP NOT NULL, -- When level was purchased/reinvested
  completed_at TIMESTAMP, -- When all positions filled
  
  -- Earnings in this cycle
  total_earnings DECIMAL(36, 18) DEFAULT 0,
  
  -- Positions filled in this cycle (JSON array of placements)
  -- Example: [{"position": 1, "userId": 123, "placedAt": "2025-11-10T12:00:00Z"}, ...]
  positions JSONB DEFAULT '[]'::jsonb,
  
  -- Is this the current active cycle?
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Blockchain data
  start_tx_hash VARCHAR(66) NOT NULL,
  completion_tx_hash VARCHAR(66),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(user_id, orbit, level_number, cycle_number)
);

CREATE INDEX idx_level_cycles_user ON level_cycles(user_id);
CREATE INDEX idx_level_cycles_orbit_level ON level_cycles(orbit, level_number);
CREATE INDEX idx_level_cycles_active ON level_cycles(is_active);
CREATE INDEX idx_level_cycles_combo ON level_cycles(user_id, orbit, level_number);
CREATE INDEX idx_level_cycles_completed ON level_cycles(completed_at DESC) WHERE completed_at IS NOT NULL;

CREATE TRIGGER update_level_cycles_updated_at
BEFORE UPDATE ON level_cycles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- EVENTS
-- Raw blockchain events for audit trail
-- ============================================

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  
  -- Event identification
  event_name VARCHAR(100) NOT NULL,
  contract VARCHAR(10) NOT NULL, -- 'OrbitA' or 'OrbitB'
  
  -- Main entities involved (for quick filtering)
  user_id INTEGER REFERENCES users(id),
  referrer_id INTEGER REFERENCES users(id),
  level_number INTEGER,
  
  -- Full event data (flexible storage)
  event_data JSONB NOT NULL,
  
  -- Blockchain data
  transaction_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMP NOT NULL,
  log_index INTEGER NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(transaction_hash, log_index)
);

CREATE INDEX idx_events_name ON events(event_name);
CREATE INDEX idx_events_contract ON events(contract);
CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_timestamp ON events(block_timestamp DESC);
CREATE INDEX idx_events_tx ON events(transaction_hash);
CREATE INDEX idx_events_data ON events USING GIN (event_data);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_levels_updated_at
BEFORE UPDATE ON user_levels
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ANNOUNCEMENTS TABLE
-- Admin announcements for the platform
-- ============================================

CREATE TABLE announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX idx_announcements_is_hidden ON announcements(is_hidden);

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- (Calculate data on-the-fly, don't store)
-- ============================================

-- User statistics (calculated in real-time)
CREATE VIEW user_stats AS
SELECT 
  u.id,
  u.user_id,
  u.wallet_address,
  u.registered_at,
  
  -- Direct referrals (partners)
  COUNT(DISTINCT ref.id) as total_partners,
  
  -- Active levels per orbit
  COUNT(DISTINCT CASE WHEN ul.orbit = 'ORBIT_A' AND ul.is_active THEN ul.level_number END) as orbit_a_levels,
  COUNT(DISTINCT CASE WHEN ul.orbit = 'ORBIT_B' AND ul.is_active THEN ul.level_number END) as orbit_b_levels,
  
  -- Earnings
  COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN p.amount ELSE 0 END), 0) as total_earned,
  COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' AND p.orbit = 'ORBIT_A' THEN p.amount ELSE 0 END), 0) as orbit_a_earned,
  COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' AND p.orbit = 'ORBIT_B' THEN p.amount ELSE 0 END), 0) as orbit_b_earned,
  
  -- Missed payments
  COALESCE(SUM(CASE WHEN p.status = 'MISSED' AND p.should_have_gone_to_user_id = u.id THEN p.amount ELSE 0 END), 0) as total_missed,
  
  -- Last activity
  MAX(p.block_timestamp) as last_activity_at
  
FROM users u
LEFT JOIN users ref ON ref.referrer_id = u.id
LEFT JOIN user_levels ul ON ul.user_id = u.id
LEFT JOIN payments p ON p.to_user_id = u.id OR p.should_have_gone_to_user_id = u.id
GROUP BY u.id;

-- Earnings by level (for charts)
CREATE VIEW user_level_earnings AS
SELECT 
  ul.user_id,
  ul.orbit,
  ul.level_number,
  ul.recycle_count,
  ul.is_active,
  
  -- Earned at this level
  COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN p.amount ELSE 0 END), 0) as earned,
  
  -- Missed at this level
  COALESCE(SUM(CASE WHEN p.status = 'MISSED' THEN p.amount ELSE 0 END), 0) as missed,
  
  -- Payment counts
  COUNT(CASE WHEN p.status = 'RECEIVED' THEN 1 END) as payment_count,
  COUNT(CASE WHEN p.status = 'MISSED' THEN 1 END) as missed_count
  
FROM user_levels ul
LEFT JOIN payments p ON 
  p.level_number = ul.level_number 
  AND p.orbit = ul.orbit
  AND (p.to_user_id = ul.user_id OR p.should_have_gone_to_user_id = ul.user_id)
WHERE ul.is_active = true
GROUP BY ul.user_id, ul.orbit, ul.level_number, ul.recycle_count, ul.is_active;

-- Platform statistics (calculated, not stored)
CREATE VIEW platform_stats AS
SELECT 
  -- Total users
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT CASE WHEN ul_a.level_number = 1 THEN u.id END) as total_users_orbit_a,
  COUNT(DISTINCT CASE WHEN ul_b.level_number = 1 THEN u.id END) as total_users_orbit_b,
  
  -- New users today
  COUNT(DISTINCT CASE WHEN u.registered_at >= CURRENT_DATE THEN u.id END) as new_users_today,
  
  -- Total earnings
  COALESCE(SUM(CASE WHEN p.status = 'RECEIVED' THEN p.amount ELSE 0 END), 0) as total_cct_earned,
  
  -- Total transactions
  COUNT(p.id) as total_transactions,
  
  -- Turnover (all payments, received or missed)
  COALESCE(SUM(p.amount), 0) as total_turnover
  
FROM users u
LEFT JOIN user_levels ul_a ON ul_a.user_id = u.id AND ul_a.orbit = 'ORBIT_A'
LEFT JOIN user_levels ul_b ON ul_b.user_id = u.id AND ul_b.orbit = 'ORBIT_B'
LEFT JOIN payments p ON p.to_user_id = u.id OR p.should_have_gone_to_user_id = u.id;

-- Activity feed
CREATE VIEW activity_feed AS
SELECT 
  e.id,
  e.event_name,
  e.contract,
  u.user_id,
  u.wallet_address,
  e.level_number,
  e.event_data->>'amount' as amount,
  e.transaction_hash,
  e.block_timestamp,
  EXTRACT(EPOCH FROM (NOW() - e.block_timestamp))::INTEGER as seconds_ago
FROM events e
LEFT JOIN users u ON e.user_id = u.id
WHERE e.event_name IN (
  'UserRegistered',
  'OrbitBActivated', 
  'LevelPurchased',
  'PaymentSent'
)
ORDER BY e.block_timestamp DESC;

-- Missed payments summary by user/level/reason
CREATE VIEW user_missed_payments_summary AS
SELECT 
  u.user_id as blockchain_user_id,
  u.id as internal_user_id,
  mp.orbit,
  mp.level_number,
  COUNT(*) as times_missed,
  SUM(CAST(mp.amount AS DECIMAL(36, 18))) as total_amount_missed,
  mp.reason,
  MAX(mp.block_timestamp) as last_missed_at
FROM users u
LEFT JOIN missed_payments mp ON mp.missed_by_user_id = u.id
GROUP BY u.user_id, u.id, mp.orbit, mp.level_number, mp.reason
ORDER BY u.user_id, mp.orbit, mp.level_number;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Admin user (ID 1) - will be created when first event is processed
-- No pre-seeding needed

-- ============================================
-- HELPER FUNCTIONS FOR QUERIES
-- ============================================

-- Get team size (recursive downlines)
CREATE OR REPLACE FUNCTION get_team_size(user_pk INTEGER)
RETURNS INTEGER AS $$
DECLARE
  team_count INTEGER;
BEGIN
  WITH RECURSIVE team AS (
    -- Direct referrals
    SELECT id, referrer_id, 1 as level
    FROM users 
    WHERE referrer_id = user_pk
    
    UNION ALL
    
    -- Recursive downlines
    SELECT u.id, u.referrer_id, t.level + 1
    FROM users u
    INNER JOIN team t ON u.referrer_id = t.id
    WHERE t.level < 100 -- Prevent infinite loops
  )
  SELECT COUNT(*) INTO team_count FROM team;
  
  RETURN COALESCE(team_count, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- Get user's downlines at specific level in matrix
CREATE OR REPLACE FUNCTION get_matrix_downlines(
  user_pk INTEGER,
  orbit_param orbit_type,
  level_num INTEGER
)
RETURNS TABLE (
  downline_user_id INTEGER,
  position_num INTEGER,
  wallet_address VARCHAR(42)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ul.user_id,
    ul.position_in_upline,
    u.wallet_address
  FROM user_levels ul
  JOIN users u ON u.id = ul.user_id
  WHERE ul.upline_id = user_pk
    AND ul.orbit = orbit_param
    AND ul.level_number = level_num
    AND ul.is_active = true
  ORDER BY ul.position_in_upline;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- PERFORMANCE NOTES
-- ============================================

/*
CACHING STRATEGY (Use Redis, not DB):
1. Platform stats - cache for 5 minutes
2. User stats - cache for 1 minute  
3. Leaderboards - cache for 10 minutes
4. Activity feed - cache for 30 seconds

MATERIALIZED VIEWS (if needed for performance):
- Create materialized view for leaderboard
- Refresh every hour via cron job
- Only if regular views are too slow

PARTITIONING (future):
- Partition events table by month if > 10M rows
- Partition payments table by month if > 10M rows
*/

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'Core user data - no calculated fields';
COMMENT ON TABLE user_levels IS 'User level activations and matrix positions';
COMMENT ON TABLE payments IS 'All payment events - received and missed';
COMMENT ON TABLE missed_payments IS 'Tracks all missed payment opportunities with detailed context';
COMMENT ON TABLE events IS 'Raw blockchain events for audit trail';
COMMENT ON TABLE announcements IS 'Admin announcements for platform updates and notifications';

COMMENT ON COLUMN payments.should_have_gone_to_user_id IS 'For MISSED payments - who should have received it but level was inactive';
COMMENT ON COLUMN user_levels.position_in_upline IS '1-4 for Orbit A, 1-6 for Orbit B';
COMMENT ON COLUMN missed_payments.missed_by_user_id IS 'User who should have received the payment';
COMMENT ON COLUMN missed_payments.received_by_user_id IS 'User who actually received it (if anyone)';
COMMENT ON COLUMN missed_payments.triggered_by_user_id IS 'User whose level purchase triggered this payment';
COMMENT ON COLUMN missed_payments.cascade_depth IS 'How many levels it cascaded (0=direct bypass, 1+=cascaded up)';

COMMENT ON VIEW user_stats IS 'Calculated user statistics - use with caching';
COMMENT ON VIEW platform_stats IS 'Platform-wide statistics - cache heavily';
COMMENT ON VIEW activity_feed IS 'Recent platform activity for feeds';
COMMENT ON VIEW user_missed_payments_summary IS 'Aggregated missed payment stats by user/level/reason';


-- ============================================
-- SAMPLE DATA (Optional)
-- ============================================

-- Insert initial welcome announcement
INSERT INTO announcements (title, body, is_hidden) VALUES
('Welcome to C-Parker Platform', 'The C-Parker admin portal is now live! Manage announcements and configure system settings from the dashboard.', false);

