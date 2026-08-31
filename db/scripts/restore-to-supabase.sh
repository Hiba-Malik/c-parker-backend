#!/bin/bash
# Restore a local PostgreSQL data dump into Supabase.
#
# Usage:
#   export SUPABASE_HOST=... SUPABASE_USER=... SUPABASE_PASSWORD=...
#   ./db/scripts/restore-to-supabase.sh [path/to/dump.sql]
#
# Default dump path: db/dumps/cparker-data.sql

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEFAULT_DUMP="$ROOT_DIR/db/dumps/cparker-data.sql"
DUMP_FILE="${1:-$DEFAULT_DUMP}"

if [ ! -f "$DUMP_FILE" ]; then
  echo -e "${RED}Dump file not found: $DUMP_FILE${NC}"
  echo "Create it first:"
  echo "  PGPASSWORD=postgres pg_dump -h localhost -U postgres -d cparker \\"
  echo "    --data-only --no-owner --no-acl \\"
  echo "    --table=users --table=user_levels --table=payments --table=events \\"
  echo "    --table=missed_payments --table=level_cycles --table=announcements \\"
  echo "    -f db/dumps/cparker-data.sql"
  exit 1
fi

# Supabase session pooler — or use direct db.xxx.supabase.co for large dumps
: "${SUPABASE_HOST:?Set SUPABASE_HOST}"
: "${SUPABASE_PORT:=5432}"
: "${SUPABASE_USER:?Set SUPABASE_USER}"
: "${SUPABASE_PASSWORD:?Set SUPABASE_PASSWORD}"
: "${SUPABASE_DB:=postgres}"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Restore local data → Supabase${NC}"
echo -e "${YELLOW}========================================${NC}"
echo "Host: $SUPABASE_HOST"
echo "Database: $SUPABASE_DB"
echo "Dump: $DUMP_FILE"
echo ""
echo -e "${RED}WARNING: This deletes all data in Supabase tables first!${NC}"
read -p "Continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

export PGPASSWORD="$SUPABASE_PASSWORD"

echo ""
echo "Clearing Supabase tables..."
psql "host=$SUPABASE_HOST port=$SUPABASE_PORT dbname=$SUPABASE_DB user=$SUPABASE_USER sslmode=require" <<'EOF'
TRUNCATE TABLE announcements, missed_payments, events, level_cycles, payments, user_levels, users RESTART IDENTITY CASCADE;
EOF

echo "Importing data (triggers disabled for circular FK on users)..."
psql "host=$SUPABASE_HOST port=$SUPABASE_PORT dbname=$SUPABASE_DB user=$SUPABASE_USER sslmode=require" <<EOF
SET session_replication_role = 'replica';
\i $DUMP_FILE
SET session_replication_role = 'origin';

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('user_levels', 'id'), COALESCE((SELECT MAX(id) FROM user_levels), 1));
SELECT setval(pg_get_serial_sequence('payments', 'id'), COALESCE((SELECT MAX(id) FROM payments), 1));
SELECT setval(pg_get_serial_sequence('events', 'id'), COALESCE((SELECT MAX(id) FROM events), 1));
SELECT setval(pg_get_serial_sequence('missed_payments', 'id'), COALESCE((SELECT MAX(id) FROM missed_payments), 1));
SELECT setval(pg_get_serial_sequence('level_cycles', 'id'), COALESCE((SELECT MAX(id) FROM level_cycles), 1));
SELECT setval(pg_get_serial_sequence('announcements', 'id'), COALESCE((SELECT MAX(id) FROM announcements), 1));
EOF

echo ""
echo "Verifying..."
psql "host=$SUPABASE_HOST port=$SUPABASE_PORT dbname=$SUPABASE_DB user=$SUPABASE_USER sslmode=require" -c "
SELECT 'users' AS t, COUNT(*) FROM users
UNION ALL SELECT 'events', COUNT(*) FROM events
UNION ALL SELECT 'payments', COUNT(*) FROM payments;
"

echo -e "${GREEN}Done!${NC}"
