# Learning Platform

A comprehensive learning platform similar to GeeksforGeeks with user authentication, progress tracking, streaks, leaderboards, and admin analytics.

## Features

- ✅ User Registration & Login with JWT authentication
- ✅ Journey Progress Tracking
- ✅ User Currency System
- ✅ Multiple User Handles Support
- ✅ Admin Dashboard with Analytics:
  - Daily Activity
  - Live Active Users
  - Monthly Active Users
  - Total Users
- ✅ Redis Caching Layer
- ✅ Streak System for Daily Learning
- ✅ User Progress Display
- ✅ Leaderboard with Rankings and Points
- ✅ Docker & Docker Compose Setup

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: React.js
- **Database**: PostgreSQL
- **Cache**: Redis
- **Containerization**: Docker & Docker Compose

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development)

## Quick Start with Docker

**Prerequisites:** Docker Desktop must be installed and running.

1. Clone the repository:
```bash
git clone <repository-url>
cd application
```

2. Start Docker services (PostgreSQL and Redis):
```bash
./start-docker.sh
```

Or manually:
```bash
docker compose up -d postgres redis
```

3. Start the application:
```bash
npm run dev
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379
- Backend API on port 5000
- Frontend on port 3000

3. Access the application:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## Local Development Setup

1. Install dependencies:
```bash
npm install
cd server && npm install
cd ../client && npm install
```

2. Set up environment variables:
```bash
cp server/.env.example server/.env
```

3. Start PostgreSQL and Redis (using Docker):
```bash
docker-compose up -d postgres redis
```

4. Start the development servers:
```bash
# From root directory
npm run dev
```

This will start both backend and frontend concurrently.

## Environment Variables

Create a `.env` file in the `server` directory:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=learning_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### User
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `GET /api/user/currency` - Get user currency

### Progress
- `GET /api/progress` - Get user progress
- `POST /api/progress/update` - Update progress
- `GET /api/progress/:topic` - Get topic progress

### Leaderboard
- `GET /api/leaderboard` - Get leaderboard (query: type=all|points|streak, limit=100)
- `GET /api/leaderboard/user/:userId` - Get user rank

### Admin
- `GET /api/admin/dashboard` - Get dashboard statistics
- `GET /api/admin/users` - Get all users (paginated)
- `GET /api/admin/activity/daily` - Get daily activity

## Project Structure

```
application/
├── server/              # Backend API
│   ├── config/         # Database and Redis configuration
│   ├── middleware/     # Authentication and active users tracking
│   ├── routes/         # API routes
│   └── index.js        # Server entry point
├── client/             # Frontend React app
│   ├── src/
│   │   ├── components/ # React components
│   │   ├── pages/      # Page components
│   │   ├── context/    # React context (Auth)
│   │   └── App.js      # Main app component
│   └── public/         # Public assets
├── docker-compose.yml  # Docker Compose configuration
├── Dockerfile          # Backend Dockerfile
└── Dockerfile.client   # Frontend Dockerfile
```

## Features Explained

### Streak System
Users earn streaks by completing activities on consecutive days. The streak is automatically updated when progress is made.

### Currency System
Users earn currency (points) when they complete topics. Currency can be used for future features like purchasing premium content.

### Caching
Redis is used to cache:
- User profiles
- Progress data
- Leaderboard data
- Admin dashboard statistics
- Active users tracking

### Admin Dashboard
Admins can view:
- Total registered users
- Monthly active users (last 30 days)
- Daily active users
- Live active users (real-time)
- Activity charts and statistics

## Default Admin

Set the `ADMIN_EMAIL` in your `.env` file. Any user with that email will have admin access.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

