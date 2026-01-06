const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'learning_platform',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

async function createAdminUser() {
  const username = 'Admin';
  const email = 'admin@example.com';
  const password = 'Admin123';

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id, username, email, is_admin FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      if (user.is_admin) {
        console.log(`✅ Admin user already exists:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Status: Already an admin`);
        console.log(`\nYou can login with:`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Password: ${password}`);
        return;
      } else {
        // User exists but not admin - make them admin
        await pool.query('UPDATE users SET is_admin = TRUE WHERE id = $1', [user.id]);
        console.log(`✅ Updated existing user to admin:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`\nYou can login with:`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Password: ${password}`);
        return;
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new admin user
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, is_admin, currency, total_points, current_streak, longest_streak, created_at, last_activity_date)
       VALUES ($1, $2, $3, TRUE, 0, 0, 0, 0, NOW(), NOW())
       RETURNING id, username, email, is_admin`,
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    console.log(`✅ Successfully created admin user:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Is Admin: ${user.is_admin}`);
    console.log(`\nYou can now login with:`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Password: ${password}`);
    console.log(`\nAccess the admin panel at: http://localhost:3000/admin`);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdminUser();

