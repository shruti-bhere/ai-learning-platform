#!/bin/bash

echo "Checking required services..."
echo ""

# Check Docker
if command -v docker &> /dev/null; then
    echo "✓ Docker is installed"
    
    # Check if Docker is running
    if docker ps &> /dev/null; then
        echo "✓ Docker daemon is running"
        
        # Check PostgreSQL container
        if docker ps | grep -q learning-platform-db; then
            echo "✓ PostgreSQL container is running"
            DB_STATUS=$(docker inspect -f '{{.State.Health.Status}}' learning-platform-db 2>/dev/null || echo "unknown")
            echo "  Status: $DB_STATUS"
        else
            echo "✗ PostgreSQL container is not running"
            echo "  Start it with: ./start-docker.sh"
        fi
        
        # Check Redis container
        if docker ps | grep -q learning-platform-redis; then
            echo "✓ Redis container is running"
            REDIS_STATUS=$(docker inspect -f '{{.State.Health.Status}}' learning-platform-redis 2>/dev/null || echo "unknown")
            echo "  Status: $REDIS_STATUS"
        else
            echo "✗ Redis container is not running"
            echo "  Start it with: ./start-docker.sh"
        fi
    else
        echo "✗ Docker daemon is not running"
        echo "  Please start Docker Desktop or Docker service"
    fi
else
    echo "✗ Docker is not installed"
    echo "  Please install Docker to use this application"
fi

echo ""
echo "Checking ports..."
# Check backend port (defaults to 1234, can be set via BACKEND_PORT env var)
BACKEND_PORT=${BACKEND_PORT:-1234}
if lsof -ti:${BACKEND_PORT} &> /dev/null; then
    echo "⚠ Port ${BACKEND_PORT} is in use (backend)"
else
    echo "✓ Port ${BACKEND_PORT} is available (backend)"
fi

if lsof -ti:3000 &> /dev/null; then
    echo "⚠ Port 3000 is in use (frontend)"
    PID=$(lsof -ti:3000)
    echo "  Process ID: $PID"
    echo "  Kill it with: kill -9 $PID"
else
    echo "✓ Port 3000 is available (frontend)"
fi

if lsof -ti:5432 &> /dev/null; then
    echo "⚠ Port 5432 is in use (PostgreSQL)"
else
    echo "✓ Port 5432 is available (PostgreSQL)"
fi

if lsof -ti:6379 &> /dev/null; then
    echo "⚠ Port 6379 is in use (Redis)"
else
    echo "✓ Port 6379 is available (Redis)"
fi

echo ""
echo "Checking environment..."
if [ -f server/.env ]; then
    echo "✓ server/.env file exists"
else
    echo "✗ server/.env file is missing"
    echo "  Run: ./setup.sh"
fi

echo ""
echo "Done!"

