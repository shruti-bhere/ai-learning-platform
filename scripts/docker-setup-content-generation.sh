#!/bin/bash
# Quick setup script for content generation with Docker

set -e

echo "🚀 Setting up Content Generation with Docker"
echo ""

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null && ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Use docker compose (newer) or docker-compose (older)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "📦 Starting Docker services..."
$DOCKER_COMPOSE up -d

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 10

echo ""
echo "🔍 Checking Ollama service..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -f -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✅ Ollama is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "   Waiting... ($attempt/$max_attempts)"
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "⚠️  Ollama took longer than expected to start. Continuing anyway..."
fi

echo ""
echo "📥 Checking if TinyLlama model is available..."
MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | grep -o "tinyllama" || true)

if [ -n "$MODELS" ]; then
  echo "✅ TinyLlama model is already available"
else
  echo "📥 TinyLlama model not found. Pulling model..."
  echo "   This may take 5-10 minutes depending on your internet speed..."
  $DOCKER_COMPOSE exec -T ollama ollama pull tinyllama || {
    echo "⚠️  Failed to pull model automatically. Please run manually:"
    echo "   docker compose exec ollama ollama pull tinyllama"
  }
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Log in as admin"
echo "   3. Navigate to Course Management"
echo "   4. Select a lesson and click '🤖 Generate with AI'"
echo ""
echo "📚 For more information, see DOCKER_CONTENT_GENERATION.md"

