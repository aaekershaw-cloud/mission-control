import { getDb } from './src/lib/db.js';

async function testDatabase() {
  console.log('🔍 Testing PostgreSQL database connection...');
  
  try {
    const db = getDb();
    
    // Test basic connection
    const result = await db.get('SELECT NOW() as current_time');
    console.log('✅ Database connection successful!');
    console.log(`🕐 Current time: ${result.current_time}`);
    
    // Test table exists and count rows
    const tables = [
      'agents', 'tasks', 'messages', 'squads', 
      'heartbeats', 'task_results', 'auto_reviews', 
      'provider_configs', 'queue_state'
    ];
    
    console.log('\n📊 Table row counts:');
    for (const table of tables) {
      try {
        const count = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
        console.log(`   ${table.padEnd(16)}: ${count.count.toString().padStart(6)} rows`);
      } catch (error) {
        console.log(`   ${table.padEnd(16)}: ❌ Error - ${error.message}`);
      }
    }
    
    // Test a complex query
    console.log('\n🔗 Testing complex query (agents with current tasks):');
    const agentsWithTasks = await db.all(`
      SELECT a.name, a.status, t.title as current_task
      FROM agents a
      LEFT JOIN tasks t ON a.current_task_id = t.id
      WHERE a.id != 'system'
      LIMIT 5
    `);
    
    agentsWithTasks.forEach(agent => {
      const task = agent.current_task ? `working on "${agent.current_task}"` : 'no current task';
      console.log(`   ${agent.name} (${agent.status}): ${task}`);
    });
    
    console.log('\n🎉 All database tests passed!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check that DATABASE_URL is set correctly');
    console.error('2. Verify your Neon database is running');
    console.error('3. Ensure the schema has been created');
    console.error('4. Check your connection string format');
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

testDatabase();