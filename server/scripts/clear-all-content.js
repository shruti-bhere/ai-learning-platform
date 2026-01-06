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

async function clearAllContent() {
  try {
    console.log('🗑️  Clearing all content from database...\n');

    // Check if --confirm flag is provided
    const args = process.argv.slice(2);
    if (args[0] !== '--confirm') {
      console.log('⚠️  WARNING: This will delete ALL lessons, topics, and courses from the database!');
      console.log('   To confirm, run: node scripts/clear-all-content.js --confirm');
      return;
    }

    // Get counts before deletion
    const lessonsCount = await pool.query('SELECT COUNT(*) FROM lessons');
    const topicsCount = await pool.query('SELECT COUNT(*) FROM topics');
    const coursesCount = await pool.query('SELECT COUNT(*) FROM courses');

    console.log(`Found ${lessonsCount.rows[0].count} lesson(s)`);
    console.log(`Found ${topicsCount.rows[0].count} topic(s)`);
    console.log(`Found ${coursesCount.rows[0].count} course(s)\n`);

    // Delete in order (lessons first due to foreign keys)
    console.log('Deleting lessons...');
    const deleteLessons = await pool.query('DELETE FROM lessons');
    console.log(`✅ Deleted ${deleteLessons.rowCount} lesson(s)`);

    console.log('Deleting topics...');
    const deleteTopics = await pool.query('DELETE FROM topics');
    console.log(`✅ Deleted ${deleteTopics.rowCount} topic(s)`);

    console.log('Deleting courses...');
    const deleteCourses = await pool.query('DELETE FROM courses');
    console.log(`✅ Deleted ${deleteCourses.rowCount} course(s)`);

    console.log('\n✅ Successfully cleared all content from database!');
    
  } catch (error) {
    console.error('❌ Error clearing content:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

clearAllContent();

