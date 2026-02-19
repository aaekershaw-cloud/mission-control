import Database from 'better-sqlite3';
import postgres from 'postgres';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.error('Set it to your Neon PostgreSQL connection string');
  process.exit(1);
}

// SQLite database path
const DB_PATH = path.join(__dirname, 'mission-control.db');

console.log('🚀 Starting Mission Control SQLite to PostgreSQL migration');
console.log(`📁 SQLite DB: ${DB_PATH}`);
console.log(`🌐 PostgreSQL: ${DATABASE_URL.split('@')[1] || 'Connected'}`);

// Initialize connections
const sqlite = new Database(DB_PATH);
const sql = postgres(DATABASE_URL);

// Helper function to convert SQLite values to PostgreSQL
function convertValue(value, columnName) {
  if (value === null || value === undefined) return null;
  
  // Convert SQLite integer booleans to PostgreSQL booleans
  if (columnName === 'read' || columnName === 'is_default') {
    return value === 1;
  }
  
  // Convert SQLite TEXT dates to PostgreSQL TIMESTAMP
  if (columnName === 'created_at' || columnName === 'updated_at' || 
      columnName === 'completed_at' || columnName === 'started_at' || 
      columnName === 'last_heartbeat' || columnName === 'timestamp') {
    if (typeof value === 'string' && value.trim()) {
      return new Date(value).toISOString();
    }
    return null;
  }
  
  // Convert SQLite JSON strings to PostgreSQL JSONB
  if (columnName === 'tags' || columnName === 'agent_ids' || 
      columnName === 'reasons' || columnName === 'checks') {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
  
  return value;
}

// Migration functions for each table
async function migrateTable(tableName, batchSize = 1000) {
  console.log(`\n📊 Migrating ${tableName}...`);
  
  // Get total count
  const countResult = sqlite.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
  const totalRows = countResult.count;
  console.log(`   Total rows: ${totalRows}`);
  
  if (totalRows === 0) {
    console.log('   No data to migrate');
    return { inserted: 0, errors: 0 };
  }
  
  // Get all data
  const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
  
  let inserted = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    try {
      await sql.begin(async sql => {
        for (const row of batch) {
          // Convert values for PostgreSQL
          const convertedRow = {};
          for (const [key, value] of Object.entries(row)) {
            convertedRow[key] = convertValue(value, key);
          }
          
          // Build insert query
          const columns = Object.keys(convertedRow);
          const values = Object.values(convertedRow);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          
          await sql.unsafe(`
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
          `, values);
        }
      });
      
      inserted += batch.length;
      if (totalRows > batchSize) {
        console.log(`   Inserted ${inserted}/${totalRows} rows (${Math.round((inserted/totalRows) * 100)}%)`);
      }
    } catch (error) {
      console.error(`   Error in batch starting at row ${i}:`, error.message);
      errors += batch.length;
    }
  }
  
  console.log(`   ✅ Completed: ${inserted} inserted, ${errors} errors`);
  return { inserted, errors };
}

async function main() {
  try {
    console.log('\n🔄 Checking PostgreSQL connection...');
    await sql`SELECT 1`;
    console.log('✅ PostgreSQL connection successful');
    
    console.log('\n🗃️  Clearing existing PostgreSQL data...');
    // Truncate with CASCADE from parent tables
    const tables = [
      'auto_reviews', 'task_results', 'heartbeats', 'messages', 
      'tasks', 'squads', 'provider_configs', 'queue_state', 'agents'
    ];
    
    for (const table of tables) {
      try {
        await sql.unsafe(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
        console.log(`   Cleared ${table}`);
      } catch (error) {
        console.log(`   Skipped ${table}: ${error.message}`);
      }
    }
    
    console.log('\n📋 Starting data migration...');
    
    // Migration order to respect foreign keys
    const migrationOrder = [
      'agents',
      'squads', 
      'provider_configs',
      'queue_state',
      'tasks',
      'messages',
      'heartbeats',
      'task_results',
      'auto_reviews'
    ];
    
    const results = {};
    let totalInserted = 0;
    let totalErrors = 0;
    
    for (const table of migrationOrder) {
      const result = await migrateTable(table, table === 'task_results' ? 500 : 1000);
      results[table] = result;
      totalInserted += result.inserted;
      totalErrors += result.errors;
    }
    
    console.log('\n📊 Migration Summary:');
    console.log('====================');
    for (const [table, result] of Object.entries(results)) {
      console.log(`${table.padEnd(15)}: ${result.inserted.toString().padStart(6)} inserted, ${result.errors.toString().padStart(2)} errors`);
    }
    console.log('====================');
    console.log(`TOTAL           : ${totalInserted.toString().padStart(6)} inserted, ${totalErrors.toString().padStart(2)} errors`);
    
    if (totalErrors === 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log(`\n⚠️  Migration completed with ${totalErrors} errors`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    sqlite.close();
    await sql.end();
  }
}

// Run migration
main().catch(console.error);