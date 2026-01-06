const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'learning_platform',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function deleteAllUsers() {
  try {
    // First, show all users
    const usersResult = await pool.query('SELECT id, username, email FROM users');
    
    if (usersResult.rows.length === 0) {
      console.log('No users found in the database.');
      return;
    }

    console.log(`Found ${usersResult.rows.length} user(s):`);
    usersResult.rows.forEach((user, index) => {
      console.log(`  ${index + 1}. ID: ${user.id}, Username: ${user.username}, Email: ${user.email}`);
    });

    // Check if --confirm flag is provided
    const args = process.argv.slice(2);
    if (args[0] !== '--confirm') {
      console.log('\n⚠️  WARNING: This will delete ALL users and all their data.');
      console.log('   To confirm, run: node scripts/delete-all-users.js --confirm');
      return;
    }

    // Delete all users (cascade will handle related records)
    const deleteResult = await pool.query('DELETE FROM users');
    
    console.log(`\n✅ Successfully deleted ${deleteResult.rowCount} user(s) and all their related data.`);
    console.log('   (This includes progress, activity, sessions, and lesson progress)');
    
  } catch (error) {
    console.error('❌ Error deleting users:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

deleteAllUsers();
