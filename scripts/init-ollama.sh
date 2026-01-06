#!/bin/bash
# Script to initialize Ollama with TinyLlama model
# This script ensures the model is available for content generation

set -e

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
MODEL_NAME="${OLLAMA_MODEL:-tinyllama}"

echo "🚀 Initializing Ollama with model: $MODEL_NAME"
echo "📍 Ollama URL: $OLLAMA_URL"

# Wait for Ollama to be ready
echo "⏳ Waiting for Ollama to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if curl -f -s "$OLLAMA_URL/api/tags" > /dev/null 2>&1; then
    echo "✅ Ollama is ready!"
    break
  fi
  attempt=$((attempt + 1))
  echo "   Attempt $attempt/$max_attempts..."
  sleep 2
done

if [ $attempt -eq $max_attempts ]; then
  echo "❌ Ollama did not become ready in time"
  exit 1
fi

# Check if model is already available
echo "🔍 Checking if model '$MODEL_NAME' is available..."
MODELS=$(curl -s "$OLLAMA_URL/api/tags" | grep -o "\"name\":\"[^\"]*\"" | grep -o "$MODEL_NAME" || true)

if [ -n "$MODELS" ]; then
  echo "✅ Model '$MODEL_NAME' is already available"
else
  echo "📥 Model '$MODEL_NAME' not found. Pulling model..."
  curl -X POST "$OLLAMA_URL/api/pull" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$MODEL_NAME\"}" \
    --no-buffer
  
  echo "✅ Model '$MODEL_NAME' pulled successfully"
fi

echo "🎉 Ollama initialization complete!"

