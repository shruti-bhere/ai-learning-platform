// API Configuration
// REACT_APP_API_URL is set by docker-compose.yml from BACKEND_PORT environment variable
// The port automatically matches the BACKEND_PORT variable in docker-compose.yml
// For local development, REACT_APP_API_URL should be set in your .env file
let API_BASE_URL = process.env.REACT_APP_API_URL;

if (!API_BASE_URL) {
  // REACT_APP_API_URL should always be set by docker-compose.yml from BACKEND_PORT
  // This should never happen in Docker - if it does, there's a configuration error
  console.error('ERROR: REACT_APP_API_URL environment variable is required.');
  console.error('For Docker: REACT_APP_API_URL is automatically set by docker-compose.yml from BACKEND_PORT');
  console.error('For local dev: Set REACT_APP_API_URL in your .env file (e.g., REACT_APP_API_URL=http://localhost:1234)');
  // Construct a fallback URL for development (without hardcoded port)
  // This will likely fail, but prevents immediate crash
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  // Try to use the same port as the frontend (unlikely to work, but better than hardcoding)
  const frontendPort = window.location.port || '3000';
  API_BASE_URL = `${protocol}//${hostname}:${frontendPort}`;
  console.error(`CRITICAL: Using invalid fallback ${API_BASE_URL} - API calls will fail. Please set REACT_APP_API_URL.`);
}
const API_BASE = `${API_BASE_URL}/api`;

const apiConfig = {
  BASE_URL: API_BASE_URL,
  API_BASE: API_BASE,
  // Helper function to build full API URL
  url: (path) => {
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    return `${API_BASE}/${cleanPath}`;
  }
};

export default apiConfig;

