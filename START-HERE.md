# 🚀 Start Here - Quick Setup Guide

## Step 1: Start Docker Desktop

**IMPORTANT:** Docker Desktop must be running before starting the application!

1. Open **Docker Desktop** application on your Mac
2. Wait for it to fully start (you'll see a whale icon 🐳 in your menu bar)
3. Make sure it says "Docker is running"

## Step 2: Start Database Services

Once Docker Desktop is running, start PostgreSQL and Redis:

```bash
./start-docker.sh
```

This will:
- Start PostgreSQL container (database)
- Start Redis container (caching)
- Wait for them to be healthy
- Show you the status

## Step 3: Start the Application

```bash
npm run dev
```

This starts both:
- Backend server on http://localhost:5000
- Frontend on http://localhost:3000

## Step 4: Open the Application

Open your browser and go to:
**http://localhost:3000**

## ✅ That's It!

The application should now be running. You can:
- Register a new account
- Login
- Start learning and tracking progress
- View leaderboard
- Access admin dashboard (if you set ADMIN_EMAIL in server/.env)

## ⚠️ Troubleshooting

### "Docker is not running"
- Make sure Docker Desktop is open and running
- Check the menu bar for the Docker icon
- Restart Docker Desktop if needed

### "Redis connection error"
- The app will work without Redis, but caching will be disabled
- To fix: Make sure Docker is running and run `./start-docker.sh`

### "Database connection error"
- Make sure Docker is running
- Run `./start-docker.sh` to start PostgreSQL
- Wait a few seconds for the database to initialize

### Port already in use
- Kill the process: `kill -9 $(lsof -ti:3000)` or `kill -9 $(lsof -ti:5000)`
- Or change ports in the configuration files

## 📝 Next Steps

1. **Set Admin Email**: Edit `server/.env` and set `ADMIN_EMAIL` to your email address
2. **Register**: Create your first account
3. **Login**: Use your credentials to login
4. **Explore**: Check out the dashboard, progress tracking, and leaderboard!

## 🆘 Need Help?

- Check `TROUBLESHOOTING.md` for detailed solutions
- Run `./check-services.sh` to verify everything is set up correctly
- Check Docker logs: `docker compose logs`

