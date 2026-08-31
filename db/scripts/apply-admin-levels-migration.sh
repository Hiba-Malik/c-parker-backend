#!/bin/bash

# Migration script to add admin user levels
# Run this if you already have admin in the database but missing their level records

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATION_FILE="$ROOT_DIR/db/migrations/migration-add-admin-levels.sql"

echo ""
echo "=========================================="
echo "  Admin Levels Migration"
echo "=========================================="
echo ""

# Load environment variables
if [ -f "$ROOT_DIR/.env" ]; then
    export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
    echo "✓ Loaded .env file"
else
    echo "⚠ No .env file found, using defaults"
fi

# Set defaults if not in .env
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_DATABASE=${DB_DATABASE:-cparker}

echo ""
echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_DATABASE"
echo "  Username: $DB_USERNAME"
echo ""

# Prompt for password if not in environment
if [ -z "$DB_PASSWORD" ]; then
    read -sp "Enter database password: " DB_PASSWORD
    echo ""
fi

export PGPASSWORD=$DB_PASSWORD

echo ""
echo "Running migration..."
echo ""

psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d $DB_DATABASE -f "$MIGRATION_FILE"

echo ""
echo "=========================================="
echo "  Migration Complete"
echo "=========================================="
echo ""
