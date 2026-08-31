#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCHEMA_FILE="$ROOT_DIR/db/schema.sql"

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}C-Parker Database Reset${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""

# Load environment variables
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
    echo -e "${GREEN}✓ Loaded .env file${NC}"
else
    echo -e "${RED}✗ .env file not found!${NC}"
    echo -e "${YELLOW}Please copy env.example to .env and configure it${NC}"
    exit 1
fi

# Check if PostgreSQL is running
echo ""
echo "Checking PostgreSQL connection..."
if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
    echo -e "${RED}✗ PostgreSQL is not running on $DB_HOST:$DB_PORT${NC}"
    echo ""
    echo "Start PostgreSQL with:"
    echo "  sudo systemctl start postgresql"
    echo "or"
    echo "  sudo service postgresql start"
    exit 1
fi
echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Check if database exists
echo ""
echo "Checking if database '$DB_DATABASE' exists..."
if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE -c '\q' 2>/dev/null; then
    echo -e "${GREEN}✓ Database exists${NC}"
else
    echo -e "${YELLOW}Database '$DB_DATABASE' does not exist. Creating...${NC}"
    PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USERNAME $DB_DATABASE
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database created${NC}"
    else
        echo -e "${RED}✗ Failed to create database${NC}"
        exit 1
    fi
fi

# Confirm reset
echo ""
echo -e "${RED}WARNING: This will DELETE ALL DATA in the database!${NC}"
echo -e "${YELLOW}Are you sure you want to reset the database? (yes/no)${NC}"
read -r response

if [ "$response" != "yes" ]; then
    echo -e "${YELLOW}Cancelled. Database not reset.${NC}"
    exit 0
fi

# Drop all tables, views, and types
echo ""
echo -e "${YELLOW}Dropping all tables, views, and types...${NC}"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE <<EOF
-- Drop all views
DROP VIEW IF EXISTS user_earnings CASCADE;
DROP VIEW IF EXISTS user_level_stats CASCADE;
DROP VIEW IF EXISTS user_cycle_stats CASCADE;
DROP VIEW IF EXISTS platform_statistics CASCADE;

-- Drop all tables
DROP TABLE IF EXISTS missed_payments CASCADE;
DROP TABLE IF EXISTS level_cycles CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS user_levels CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop all types
DROP TYPE IF EXISTS orbit_type CASCADE;
DROP TYPE IF EXISTS event_type CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS missed_payment_reason CASCADE;
EOF

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Dropped all tables and types${NC}"
else
    echo -e "${RED}✗ Failed to drop tables${NC}"
    exit 1
fi

# Run schema
echo ""
echo "Creating fresh database schema..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Database reset complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "Database has been reset and schema recreated."
    echo ""
    echo "Next steps:"
    echo "1. Make sure ENABLE_EVENT_LISTENER=true in .env"
    echo "2. Set your contract addresses in .env"
    echo "3. Run: npm run start:dev"
    echo ""
else
    echo -e "${RED}✗ Failed to run schema${NC}"
    exit 1
fi
