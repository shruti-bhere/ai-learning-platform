# Code Analysis Service

A lightweight microservice for code analysis using Ollama with tiny models.

## Features

- **Lightweight**: Uses `tinyllama:1.1b` model (~637MB) - very fast and efficient
- **Separate Service**: Runs as an independent microservice
- **Automatic Fallback**: Falls back to static analysis if Ollama is unavailable
- **Docker Ready**: Easy to deploy with Docker Compose

## Quick Start

The service is automatically started with `docker compose up`. It will:

1. Pull the lightweight Ollama model on first run
2. Start the code analysis service
3. Connect to Ollama service

## Manual Setup

If running outside Docker:

```bash
cd code-analysis-service
npm install
OLLAMA_HOST=http://localhost:11434 OLLAMA_MODEL=tinyllama:1.1b npm start
```

## Available Models

The service uses `tinyllama:1.1b` by default. You can change it by setting `OLLAMA_MODEL`:

- `tinyllama:1.1b` (default) - ~637MB, fastest
- `phi-2:2.7b` - ~1.6GB, more accurate
- `qwen2:0.5b` - ~350MB, smallest

## API Endpoints

### POST /analyze

Analyze code for quality, issues, and improvements.

**Request:**
```json
{
  "code": "public class Test { ... }",
  "language": "java"
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "quality_score": 85,
    "strengths": ["..."],
    "issues": [...],
    "improvements": ["..."],
    "best_practices": ["..."],
    "summary": "..."
  },
  "model": "tinyllama:1.1b"
}
```

### GET /health

Check service health and Ollama availability.

**Response:**
```json
{
  "status": "ok",
  "ollama_available": true,
  "model": "tinyllama:1.1b"
}
```

## Environment Variables

- `PORT` - Service port (default: 5001)
- `OLLAMA_HOST` - Ollama service URL (default: http://ollama:11434)
- `OLLAMA_MODEL` - Model to use (default: tinyllama:1.1b)

## Performance

- **Model Size**: ~637MB
- **Memory Usage**: ~1-2GB RAM
- **Analysis Time**: 2-5 seconds per request
- **CPU**: Works on CPU (no GPU required)
