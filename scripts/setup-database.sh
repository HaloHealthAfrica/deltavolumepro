#!/bin/bash

# DeltaStackPro Database Setup Script
# This script sets up the database with migrations, indexes, and seed data

echo "🚀 Setting up DeltaStackPro database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL environment variable is not set"
    echo "Please set DATABASE_URL in your .env file"
    exit 1
fi

echo "📋 Step 1: Generating Prisma client..."
npx prisma generate

echo "📋 Step 2: Creating database migration..."
npx prisma migrate dev --name init --create-only

echo "📋 Step 3: Applying migration to database..."
npx prisma migrate deploy

echo "📋 Step 4: Seeding database with initial data..."
npm run db:seed

echo "✅ Database setup completed successfully!"
echo ""
echo "🎯 Next steps:"
echo "  - Run 'npm run db:studio' to view your database"
echo "  - Check the seed data was created correctly"
echo "  - Start your application with 'npm run dev'"