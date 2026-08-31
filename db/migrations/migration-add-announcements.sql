-- ============================================
-- ANNOUNCEMENTS TABLE MIGRATION
-- Add announcements functionality to C-Parker Backend
-- ============================================

-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_is_hidden ON announcements(is_hidden);

-- Add trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_announcements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION update_announcements_updated_at();

-- Insert sample announcement (optional)
INSERT INTO announcements (title, body, is_hidden) VALUES
('Welcome to C-Parker Admin Portal', 'The admin portal is now live! You can manage announcements and configure system settings.', false);

-- Verification
SELECT 'Announcements table created successfully!' AS status;
SELECT COUNT(*) AS announcement_count FROM announcements;




