#!/bin/bash

echo "Starting Docker services for Learning Platform..."
echo ""

# Check if Docker is running
if ! docker ps &> /dev/null; then
    echo "❌ Docker is not running!"
    echo ""
    echo "Please start Docker Desktop:"
    echo "  1. Open Docker Desktop application"
    echo "  2. Wait for it to fully start (whale icon in menu bar)"
    echo "  3. Run this script again"
    echo ""
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Start PostgreSQL and Redis
echo "Starting PostgreSQL and Redis containers..."
docker compose up -d postgres redis

echo ""
echo "Waiting for services to be healthy..."
sleep 5

# Check service status
echo ""
echo "Service Status:"
docker compose ps

echo ""
echo "✓ Services started!"
echo ""
echo "You can now start the application with:"
echo "  npm run dev"
echo ""
echo "To view logs:"
echo "  docker compose logs -f postgres"
echo "  docker compose logs -f redis"

