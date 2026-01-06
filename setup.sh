#!/bin/bash

echo "Setting up Learning Platform..."

# Create .env file if it doesn't exist
if [ ! -f server/.env ]; then
    echo "Creating server/.env file..."
    cat > server/.env << EOF
PORT=1234
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=learning_platform
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=http://localhost:3000
ADMIN_EMAIL=admin@example.com
EOF
    echo "✓ Created server/.env file"
else
    echo "✓ server/.env already exists"
fi

# Install root dependencies
echo "Installing root dependencies..."
npm install

# Install server dependencies
echo "Installing server dependencies..."
cd server && npm install && cd ..

# Install client dependencies
echo "Installing client dependencies..."
cd client && npm install && cd ..

echo ""
echo "Setup complete! 🎉"
echo ""
echo "To start the application:"
echo "  - With Docker: docker-compose up -d"
echo "  - Local dev: npm run dev"
echo ""
echo "Don't forget to:"
echo "  1. Update server/.env with your configuration"
echo "  2. Set ADMIN_EMAIL to your admin email address"

