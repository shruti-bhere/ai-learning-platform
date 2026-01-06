const { Pool } = require('pg');
const redis = require('./redis');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'learning_platform',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
  // Connection retry settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for Docker containers
});

// Test connection with retry (wait longer for Docker containers)
const testConnection = async (retries = 10, delay = 3000) => {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query('SELECT NOW()');
      return true;
    } catch (error) {
      if (i === retries - 1) {
        throw error;
      }
      if (i < 3) { // Only log first few attempts
        console.log(`Database connection attempt ${i + 1} failed, retrying in ${delay}ms...`);
      }
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

const initDatabase = async () => {
  try {
    // Test connection first
    console.log('Testing database connection...');
    await testConnection();
    console.log('Database connection successful!');
    
    // Note: Docker PostgreSQL container creates the database automatically via POSTGRES_DB env var
    // So we don't need to create it manually

    // Create tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        currency INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add is_admin column if it doesn't exist (for existing databases)
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
      `);
    } catch (err) {
      // Column might already exist, ignore error
      console.log('is_admin column may already exist:', err.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        topic VARCHAR(100) NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        progress_percentage INTEGER DEFAULT 0,
        points_earned INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_activity (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        activity_date DATE NOT NULL,
        points_earned INTEGER DEFAULT 0,
        topics_completed INTEGER DEFAULT 0,
        time_spent_minutes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, activity_date)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        session_end TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lessons (
        id SERIAL PRIMARY KEY,
        course_id INTEGER REFERENCES courses(id) ON DELETE CASCADE,
        title VARCHAR(200) NOT NULL,
        slug VARCHAR(200) NOT NULL,
        content TEXT,
        examples JSONB,
        code_example TEXT,
        code_language VARCHAR(20) DEFAULT 'java',
        order_index INTEGER NOT NULL,
        difficulty VARCHAR(20) DEFAULT 'beginner',
        estimated_time INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(course_id, slug)
      )
    `);

    // Add code_example and code_language columns if they don't exist (for existing databases)
    try {
      await pool.query(`
        ALTER TABLE lessons 
        ADD COLUMN IF NOT EXISTS code_example TEXT
      `);
      await pool.query(`
        ALTER TABLE lessons 
        ADD COLUMN IF NOT EXISTS code_language VARCHAR(20) DEFAULT 'java'
      `);
    } catch (err) {
      // Columns might already exist, ignore error
      console.log('Code columns may already exist:', err.message);
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        lesson_id INTEGER REFERENCES lessons(id) ON DELETE CASCADE,
        completed BOOLEAN DEFAULT FALSE,
        progress_percentage INTEGER DEFAULT 0,
        points_earned INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, lesson_id)
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
      CREATE INDEX IF NOT EXISTS idx_daily_activity_user_id ON daily_activity(user_id);
      CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON daily_activity(activity_date);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_course_id ON lessons(course_id);
      CREATE INDEX IF NOT EXISTS idx_lesson_progress_user_id ON lesson_progress(user_id);
      CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson_id ON lesson_progress(lesson_id);
    `);

    // Insert default courses if they don't exist
    await pool.query(`
      INSERT INTO courses (name, slug, description, icon) VALUES
      ('Java', 'java', 'Learn Java programming from basics to advanced concepts', '☕'),
      ('Python', 'python', 'Master Python programming language step by step', '🐍'),
      ('Node.js', 'nodejs', 'Build server-side applications with Node.js', '🟢'),
      ('Golang', 'golang', 'Learn Go programming language for modern development', '🐹')
      ON CONFLICT (slug) DO NOTHING
    `);

    // Insert sample lessons for each course
    const courses = await pool.query('SELECT id, slug FROM courses');
    
    for (const course of courses.rows) {
      const lessons = course.slug === 'java' ? [
        { title: 'Introduction to Java', order: 1, difficulty: 'beginner', content: 'Learn the basics of Java programming language, its history, and why it\'s popular.' },
        { title: 'Java Syntax and Variables', order: 2, difficulty: 'beginner', content: 'Understand Java syntax, data types, and how to declare and use variables.' },
        { title: 'Control Flow and Loops', order: 3, difficulty: 'beginner', content: 'Master if-else statements, switch cases, and different types of loops.' },
        { title: 'Object-Oriented Programming', order: 4, difficulty: 'intermediate', content: 'Learn classes, objects, inheritance, polymorphism, and encapsulation.' },
        { title: 'Collections and Generics', order: 5, difficulty: 'intermediate', content: 'Work with ArrayList, HashMap, and understand generics in Java.' },
        { title: 'Exception Handling', order: 6, difficulty: 'intermediate', content: 'Learn how to handle errors and exceptions in Java applications.' },
        { title: 'Multithreading', order: 7, difficulty: 'advanced', content: 'Understand concurrent programming with threads and synchronization.' },
        { title: 'Java Streams and Lambda', order: 8, difficulty: 'advanced', content: 'Master functional programming with streams and lambda expressions.' }
      ] : course.slug === 'python' ? [
        { title: 'Python Basics', order: 1, difficulty: 'beginner', content: 'Introduction to Python, installation, and your first program.' },
        { title: 'Variables and Data Types', order: 2, difficulty: 'beginner', content: 'Learn about Python variables, strings, numbers, and data types.' },
        { title: 'Lists and Dictionaries', order: 3, difficulty: 'beginner', content: 'Work with Python lists, dictionaries, and other data structures.' },
        { title: 'Functions and Modules', order: 4, difficulty: 'intermediate', content: 'Create functions, use modules, and organize your code.' },
        { title: 'Object-Oriented Programming', order: 5, difficulty: 'intermediate', content: 'Learn classes, objects, and OOP concepts in Python.' },
        { title: 'File Handling', order: 6, difficulty: 'intermediate', content: 'Read and write files, handle exceptions, and work with data.' },
        { title: 'Decorators and Generators', order: 7, difficulty: 'advanced', content: 'Master Python decorators and generator functions.' },
        { title: 'Async Programming', order: 8, difficulty: 'advanced', content: 'Learn asynchronous programming with async/await in Python.' }
      ] : course.slug === 'nodejs' ? [
        { title: 'Introduction to Node.js', order: 1, difficulty: 'beginner', content: 'Learn what Node.js is, its architecture, and why it\'s powerful.' },
        { title: 'Node.js Modules and NPM', order: 2, difficulty: 'beginner', content: 'Understand CommonJS modules, require, exports, and NPM packages.' },
        { title: 'File System Operations', order: 3, difficulty: 'beginner', content: 'Read and write files, work with directories using fs module.' },
        { title: 'HTTP Server and Express', order: 4, difficulty: 'intermediate', content: 'Create HTTP servers and build REST APIs with Express.js.' },
        { title: 'Database Integration', order: 5, difficulty: 'intermediate', content: 'Connect to databases, use ORMs, and handle data persistence.' },
        { title: 'Authentication and Security', order: 6, difficulty: 'intermediate', content: 'Implement JWT authentication and secure your applications.' },
        { title: 'Real-time with Socket.io', order: 7, difficulty: 'advanced', content: 'Build real-time applications using WebSockets and Socket.io.' },
        { title: 'Performance and Optimization', order: 8, difficulty: 'advanced', content: 'Optimize Node.js applications, caching, and scaling strategies.' }
      ] : [
        { title: 'Go Basics', order: 1, difficulty: 'beginner', content: 'Introduction to Go language, installation, and basic syntax.' },
        { title: 'Variables and Types', order: 2, difficulty: 'beginner', content: 'Learn Go data types, variables, constants, and type system.' },
        { title: 'Functions and Methods', order: 3, difficulty: 'beginner', content: 'Create functions, methods, and understand Go\'s unique approach.' },
        { title: 'Structs and Interfaces', order: 4, difficulty: 'intermediate', content: 'Work with structs, interfaces, and Go\'s type system.' },
        { title: 'Concurrency with Goroutines', order: 5, difficulty: 'intermediate', content: 'Master goroutines, channels, and concurrent programming.' },
        { title: 'Error Handling', order: 6, difficulty: 'intermediate', content: 'Learn Go\'s error handling patterns and best practices.' },
        { title: 'Package Management', order: 7, difficulty: 'advanced', content: 'Understand Go modules, package organization, and dependencies.' },
        { title: 'Advanced Patterns', order: 8, difficulty: 'advanced', content: 'Explore advanced Go patterns, testing, and production practices.' }
      ];

      for (const lesson of lessons) {
        await pool.query(`
          INSERT INTO lessons (course_id, title, slug, content, order_index, difficulty, estimated_time)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (course_id, slug) DO NOTHING
        `, [
          course.id,
          lesson.title,
          lesson.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          lesson.content,
          lesson.order,
          lesson.difficulty,
          Math.floor(Math.random() * 30) + 10 // 10-40 minutes
        ]);
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error.message);
    console.error('Make sure PostgreSQL is running and accessible.');
    console.error('If using Docker: docker-compose up -d postgres');
    // Don't throw - allow server to start even if DB init fails
    // The connection will be retried on first query
  }
};

module.exports = { pool, initDatabase };

