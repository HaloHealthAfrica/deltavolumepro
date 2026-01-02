# DeltaStackPro Database Setup

This directory contains the database schema, migrations, and seed data for the DeltaStackPro trading system.

## Quick Start

1. **Ensure your database is running** and `DATABASE_URL` is set in your `.env` file
2. **Run the setup script**:
   ```bash
   # On Unix/Linux/macOS
   chmod +x scripts/setup-database.sh
   ./scripts/setup-database.sh
   
   # On Windows (PowerShell)
   .\scripts\setup-database.ps1
   ```

## Manual Setup

If you prefer to run the commands manually:

```bash
# 1. Generate Prisma client
npm run db:generate

# 2. Create and apply migration
npm run db:migrate

# 3. Seed the database
npm run db:seed

# 4. (Optional) Open Prisma Studio
npm run db:studio
```

## Database Schema Overview

### Core Models

- **Signal**: Raw trading signals from external sources
- **EnrichedData**: Additional market data for signals
- **Decision**: AI-driven trading decisions
- **Trade**: Executed trades and their outcomes
- **TradeAnalysis**: Post-trade analysis for learning
- **TradingRules**: Configurable trading parameters
- **MarketContext**: Broad market conditions

### Performance Indexes

The schema includes optimized indexes for:

- **Signal queries**: `status`, `ticker`, `timestamp`, `quality`
- **Trade queries**: `status`, `ticker`, `enteredAt`, `exitedAt`
- **Decision queries**: `decision`, `confidence`
- **Time-based queries**: `createdAt`, `timestamp`
- **Composite indexes**: Common query patterns

## Seed Data

The seed script creates:

1. **Default Trading Rules** (`v1.0.0`):
   - Conservative risk parameters (2% max risk)
   - Quality-based position sizing
   - Standard timeframes (5, 15, 30, 60 minutes)
   - Market hours: 9:30 AM - 4:00 PM ET

2. **Sample Market Context**:
   - Current market regime assessment
   - Sector rotation data
   - VIX and SPY levels

3. **Test Signal** (optional):
   - Sample signal for testing the pipeline

## Database Commands

```bash
# Development workflow
npm run db:migrate      # Create and apply new migration
npm run db:push         # Push schema changes (no migration)
npm run db:seed         # Run seed script
npm run db:studio       # Open Prisma Studio
npm run db:reset        # Reset database (⚠️ destructive)

# Production workflow
npx prisma migrate deploy  # Apply migrations in production
npx prisma generate        # Generate client after schema changes
```

## Environment Variables

Required in your `.env` file:

```env
DATABASE_URL="your-database-connection-string"
```

For local development with Prisma Postgres:
```env
DATABASE_URL="prisma+postgres://localhost:51213/?api_key=your-api-key"
```

## Migration Strategy

1. **Development**: Use `prisma migrate dev` for schema changes
2. **Production**: Use `prisma migrate deploy` for applying migrations
3. **Schema Updates**: Always create migrations for schema changes
4. **Rollbacks**: Use migration files to track and rollback changes

## Performance Considerations

### Indexes Added

- **Single column indexes**: Frequently queried fields
- **Composite indexes**: Common query patterns
- **Unique indexes**: Enforce data integrity
- **Timestamp indexes**: Time-based queries and sorting

### Query Optimization

The indexes support these common query patterns:

```sql
-- Signal queries
SELECT * FROM signals WHERE status = 'received' ORDER BY createdAt DESC;
SELECT * FROM signals WHERE ticker = 'SPY' AND timestamp > ?;

-- Trade queries  
SELECT * FROM trades WHERE status = 'OPEN';
SELECT * FROM trades WHERE ticker = 'SPY' ORDER BY enteredAt DESC;

-- Decision queries
SELECT * FROM decisions WHERE decision = 'TRADE' AND confidence > 0.8;
```

## Troubleshooting

### Common Issues

1. **Database connection failed**:
   - Check `DATABASE_URL` in `.env`
   - Ensure database server is running
   - Verify network connectivity

2. **Migration failed**:
   - Check for schema conflicts
   - Ensure database user has proper permissions
   - Review migration logs

3. **Seed script failed**:
   - Ensure migrations are applied first
   - Check for data conflicts
   - Review seed script logs

### Reset Database

If you need to start fresh:

```bash
npm run db:reset  # ⚠️ This will delete all data
npm run db:seed   # Re-seed with initial data
```

## Production Deployment

1. **Apply migrations**: `npx prisma migrate deploy`
2. **Generate client**: `npx prisma generate`
3. **Seed production data**: Customize seed script for production
4. **Monitor performance**: Use database monitoring tools
5. **Backup strategy**: Implement regular backups

## Security Notes

- Never commit `.env` files with real credentials
- Use connection pooling in production
- Implement proper database user permissions
- Monitor for slow queries and optimize indexes
- Use SSL connections for remote databases