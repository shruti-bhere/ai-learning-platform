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

async function makeAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node make-admin.js <email-or-username>');
    console.log('Example: node make-admin.js admin@example.com');
    console.log('Example: node make-admin.js adminuser');
    process.exit(1);
  }

  const identifier = args[0];
  const isEmail = identifier.includes('@');

  try {
    let query, params;
    if (isEmail) {
      query = 'UPDATE users SET is_admin = TRUE WHERE email = $1 RETURNING id, username, email';
      params = [identifier];
    } else {
      query = 'UPDATE users SET is_admin = TRUE WHERE username = $1 RETURNING id, username, email';
      params = [identifier];
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      console.log(`❌ User not found: ${identifier}`);
      process.exit(1);
    }

    const user = result.rows[0];
    console.log(`✅ Successfully made user admin:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Email: ${user.email}`);
    console.log(`\nYou can now access the admin panel at: http://localhost:3000/admin`);
  } catch (error) {
    console.error('❌ Error making user admin:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

makeAdmin();

