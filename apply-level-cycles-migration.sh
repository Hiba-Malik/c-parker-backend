#!/bin/bash

# Load environment variables
source .env

# Apply migration
echo "Adding level_cycles table..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -f migration-add-level-cycles.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration applied successfully!"
else
    echo "❌ Migration failed!"
    exit 1
fi

