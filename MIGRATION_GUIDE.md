# Mission Control PostgreSQL Migration Guide

This guide will help you migrate Mission Control from SQLite to PostgreSQL using Neon.

## Prerequisites

- Current SQLite database at `mission-control.db` with your data
- Node.js environment set up
- Access to create a Neon PostgreSQL database

## Step 1: Create Neon PostgreSQL Database

### Option A: Using Neon CLI (Recommended)

1. Install and authenticate with Neon CLI:
```bash
npx neonctl auth
```

2. Create a new project:
```bash
npx neonctl projects create --name mission-control
```

3. Get your connection string:
```bash
npx neonctl connection-string --database-name mc
```

### Option B: Using Neon Web Console

1. Go to https://console.neon.tech
2. Sign up/log in to your account
3. Click "Create Project"
4. Name it "mission-control"
5. Select your region (choose closest to your Railway deployment)
6. Copy the connection string (use the **Pooled connection** for serverless)

## Step 2: Set Environment Variables

Add the connection string to your environment files:

### Local Development (.env.local)
```bash
# Add this to your .env.local file
DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
```

### Railway Production
```bash
# Set Railway environment variable
npx railway variables set DATABASE_URL="postgresql://username:password@host/database?sslmode=require"
```

## Step 3: Install Dependencies

The new dependencies are already in package.json. Install them:

```bash
npm install
```

## Step 4: Create PostgreSQL Schema

Run the schema creation script:

```bash
psql $DATABASE_URL -f schema.sql
```

Or use your preferred PostgreSQL client to run the schema.sql file.

## Step 5: Migrate Data

Run the migration script to transfer data from SQLite to PostgreSQL:

```bash
DATABASE_URL="your-neon-connection-string" node migrate-to-pg.mjs
```

This will:
- Read all data from your SQLite database
- Convert data types (JSON strings → JSONB, integers → booleans, etc.)
- Insert data into PostgreSQL in the correct order (respecting foreign keys)
- Handle the large task_results table (17,803 rows) in batches
- Show progress and statistics

Expected output:
```
🚀 Starting Mission Control SQLite to PostgreSQL migration
📁 SQLite DB: /path/to/mission-control.db
🌐 PostgreSQL: your-neon-host/database

📊 Migrating agents...
   Total rows: 13
   ✅ Completed: 13 inserted, 0 errors

📊 Migrating tasks...
   Total rows: 134
   ✅ Completed: 134 inserted, 0 errors

... (continues for all tables)

📊 Migration Summary:
==================
agents          :     13 inserted,  0 errors
squads          :      9 inserted,  0 errors
tasks           :    134 inserted,  0 errors
messages        :    192 inserted,  0 errors
heartbeats      :    372 inserted,  0 errors
task_results    :  17803 inserted,  0 errors
auto_reviews    :     21 inserted,  0 errors
provider_configs:      3 inserted,  0 errors
queue_state     :      1 inserted,  0 errors
==================
TOTAL           :  18548 inserted,  0 errors

✅ Migration completed successfully!
```

## Step 6: Test Local Development

Start your local development server:

```bash
npm run dev
```

Visit http://localhost:3003 and verify:
- All agents are visible
- Tasks load correctly on the kanban board  
- Task details modal works
- Agent dashboard shows stats
- Messages are displayed

## Step 7: Deploy to Railway

Commit your changes:

```bash
git add .
git commit -m "Migrate from SQLite to PostgreSQL (Neon)"
git push
```

Railway will automatically deploy. Monitor the logs to ensure successful deployment.

## Step 8: Verify Production

Once deployed, check your Railway production URL:
- Verify all data is present
- Test creating a new task
- Test the auto-queue functionality
- Check that both local and Railway instances are using the same shared database

## Step 9: Clean Up (Optional)

After confirming everything works:

1. Remove the old SQLite database file:
```bash
rm mission-control.db mission-control.db-shm mission-control.db-wal
```

2. Remove the db-upload route (no longer needed):
```bash
rm -rf src/app/api/db-upload
```

3. Update your .gitignore to remove SQLite references:
```bash
# Remove these lines from .gitignore:
# *.db
# *.db-shm  
# *.db-wal
```

## Troubleshooting

### Connection Issues
- Ensure your DATABASE_URL is correct and includes `?sslmode=require`
- Check that your IP is allowed (Neon has IP allowlisting options)
- Verify the database name in the connection string

### Migration Issues
- If migration fails partway, you can re-run it (it truncates tables first)
- Check that your SQLite database file exists and is readable
- For large datasets, increase batch size in the migration script

### Runtime Issues
- Check that all environment variables are set correctly
- Monitor application logs for database connection errors
- Verify foreign key constraints are working

## Schema Differences

Key changes from SQLite to PostgreSQL:
- `AUTOINCREMENT` → `SERIAL` (heartbeats.id)
- `TEXT` dates → `TIMESTAMP` with `NOW()` defaults
- `INTEGER` booleans (0/1) → `BOOLEAN` (true/false)
- `TEXT` JSON → `JSONB` (tags, agent_ids, reasons, checks)

## Performance Notes

- Neon free tier: 0.5 GB storage, 190 compute hours/month
- Connection pooling is handled by the postgres client
- JSONB queries are more efficient than JSON text parsing
- Consider adding indexes for frequently queried columns

## Rollback Plan

If you need to rollback:
1. Keep your SQLite database as backup
2. Change DATABASE_URL back to use SQLite (not supported by new code)
3. Or use the migration script in reverse (would need to be written)

## Next Steps

- Monitor database usage in Neon console
- Set up automated backups if needed
- Consider upgrading Neon plan as your data grows
- Add database monitoring/alerting