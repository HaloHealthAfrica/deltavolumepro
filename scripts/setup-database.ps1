# DeltaStackPro Database Setup Script (PowerShell)
# This script sets up the database with migrations, indexes, and seed data

Write-Host "🚀 Setting up DeltaStackPro database..." -ForegroundColor Green

# Check if DATABASE_URL is set
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL environment variable is not set" -ForegroundColor Red
    Write-Host "Please set DATABASE_URL in your .env file" -ForegroundColor Yellow
    exit 1
}

Write-Host "📋 Step 1: Generating Prisma client..." -ForegroundColor Blue
npx prisma generate

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to generate Prisma client" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 2: Creating database migration..." -ForegroundColor Blue
npx prisma migrate dev --name init --create-only

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to create migration" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 3: Applying migration to database..." -ForegroundColor Blue
npx prisma migrate deploy

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to apply migration" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Step 4: Seeding database with initial data..." -ForegroundColor Blue
npm run db:seed

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to seed database" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Database setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Cyan
Write-Host "  - Run 'npm run db:studio' to view your database" -ForegroundColor White
Write-Host "  - Check the seed data was created correctly" -ForegroundColor White
Write-Host "  - Start your application with 'npm run dev'" -ForegroundColor White