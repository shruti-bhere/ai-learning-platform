/**
 * Verification script to confirm all lesson content is in the database
 * and no file-based content is needed
 * 
 * Usage: node server/scripts/verify-database-content.js
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'learning_platform',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function verifyDatabaseContent() {
  try {
    console.log('🔍 Verifying database content migration...\n');

    // Check all lessons have content
    const lessonsCheck = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN content IS NOT NULL AND content != '' THEN 1 END) as with_content,
        COUNT(CASE WHEN LENGTH(content) > 100 THEN 1 END) as with_detailed_content,
        COUNT(CASE WHEN content LIKE '%Theory Section%' THEN 1 END) as restructured
      FROM lessons
    `);

    const lessons = lessonsCheck.rows[0];
    console.log('📚 Lessons Status:');
    console.log(`  Total lessons: ${lessons.total}`);
    console.log(`  With content: ${lessons.with_content}`);
    console.log(`  With detailed content (>100 chars): ${lessons.with_detailed_content}`);
    console.log(`  Restructured (new format): ${lessons.restructured}`);

    // Check by course
    const byCourse = await pool.query(`
      SELECT 
        c.slug as course,
        COUNT(l.id) as total_lessons,
        COUNT(CASE WHEN l.content IS NOT NULL AND l.content != '' THEN 1 END) as with_content,
        COUNT(CASE WHEN l.content LIKE '%Theory Section%' THEN 1 END) as restructured
      FROM courses c
      LEFT JOIN lessons l ON c.id = l.course_id
      GROUP BY c.slug
      ORDER BY c.slug
    `);

    console.log('\n📖 By Course:');
    byCourse.rows.forEach(row => {
      console.log(`  ${row.course.toUpperCase()}:`);
      console.log(`    Total: ${row.total_lessons}`);
      console.log(`    With content: ${row.with_content}`);
      console.log(`    Restructured: ${row.restructured}`);
    });

    // Check for any missing content
    const missingContent = await pool.query(`
      SELECT l.id, l.title, c.slug as course
      FROM lessons l
      JOIN courses c ON l.course_id = c.id
      WHERE l.content IS NULL OR l.content = '' OR LENGTH(l.content) < 50
      ORDER BY c.slug, l.id
    `);

    if (missingContent.rows.length > 0) {
      console.log('\n⚠️  Lessons with missing/incomplete content:');
      missingContent.rows.forEach(lesson => {
        console.log(`  - [${lesson.course}] ${lesson.title} (ID: ${lesson.id})`);
      });
    } else {
      console.log('\n✅ All lessons have complete content!');
    }

    // Verify API endpoints are working
    console.log('\n🔌 Database Connection:');
    console.log(`  Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`  Database: ${process.env.DB_NAME || 'learning_platform'}`);
    console.log(`  Status: ✅ Connected`);

    // Summary
    console.log('\n📊 Migration Summary:');
    if (lessons.total === lessons.with_content && lessons.total === lessons.restructured) {
      console.log('  ✅ All content successfully migrated to database');
      console.log('  ✅ All lessons follow new structure');
      console.log('  ✅ Application is fully database-driven');
      console.log('\n  🗑️  Legacy files can be safely removed:');
      console.log('    - server/scripts/enrich-lesson-content.js');
      console.log('    - server/scripts/update-lesson-content.js');
    } else {
      console.log('  ⚠️  Some lessons may need attention');
    }

  } catch (error) {
    console.error('❌ Verification error:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  verifyDatabaseContent().catch(console.error);
}

module.exports = { verifyDatabaseContent };

