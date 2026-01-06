const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const progressRoutes = require('./routes/progress');
const adminRoutes = require('./routes/admin');
const leaderboardRoutes = require('./routes/leaderboard');
const coursesRoutes = require('./routes/courses');
const lessonsRoutes = require('./routes/lessons');
const executeRoutes = require('./routes/execute');
const { initDatabase } = require('./config/database');
const { initRedis } = require('./config/redis');
const { trackActiveUsers } = require('./middleware/activeUsers');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize database and Redis (non-blocking)
initDatabase().catch(err => {
  console.error('Failed to initialize database:', err.message);
});

initRedis().catch(err => {
  console.error('Failed to initialize Redis:', err.message);
});

// Socket.io for real-time active users
const userSocketMap = new Map(); // Map socket.id to userId

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('user-active', (userId) => {
    userSocketMap.set(socket.id, userId);
    trackActiveUsers(userId, true);
  });

  socket.on('disconnect', () => {
    const userId = userSocketMap.get(socket.id);
    if (userId) {
      trackActiveUsers(userId, false);
      userSocketMap.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/lessons', lessonsRoutes);
app.use('/api/execute', executeRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io };

