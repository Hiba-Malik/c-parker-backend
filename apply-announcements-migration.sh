#!/bin/bash

# ============================================
# Apply Announcements Migration Script
# ============================================

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep -v '^$' | xargs)
fi

# Set defaults if not found in .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_DATABASE=${DB_DATABASE:-cparker}

echo "============================================"
echo "Applying Announcements Migration"
echo "============================================"
echo "Database: $DB_DATABASE"
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USERNAME"
echo ""

# Check if PostgreSQL is accessible
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Check if migration file exists
if [ ! -f "migration-add-announcements.sql" ]; then
    echo "❌ Error: migration-add-announcements.sql not found"
    exit 1
fi

echo "Applying migration..."
echo ""

# Apply migration
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE -f migration-add-announcements.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "Next steps:"
    echo "1. Restart your NestJS backend: npm run start:dev"
    echo "2. Check API docs at: http://localhost:4000/docs"
    echo "3. Test announcements API: http://localhost:4000/api/v1/announcements"
else
    echo ""
    echo "❌ Migration failed. Check the error messages above."
    exit 1
fi



