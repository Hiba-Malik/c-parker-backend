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
echo -e "${YELLOW}C-Parker Database Setup${NC}"
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
DB_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -lqt | cut -d \| -f 1 | grep -w $DB_DATABASE | wc -l)

if [ $DB_EXISTS -eq 0 ]; then
    echo -e "${YELLOW}Database '$DB_DATABASE' does not exist. Creating...${NC}"
    PGPASSWORD=$DB_PASSWORD createdb -h $DB_HOST -p $DB_PORT -U $DB_USERNAME $DB_DATABASE
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Database created${NC}"
    else
        echo -e "${RED}✗ Failed to create database${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ Database already exists${NC}"
fi

# Run schema
echo ""
echo "Running database schema..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE -f "$SCHEMA_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✓ Database setup complete!${NC}"
    echo -e "${GREEN}========================================${NC}"
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
