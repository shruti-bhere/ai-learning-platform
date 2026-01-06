const redis = require('redis');

let redisClient = null;
let redisConnected = false;

const initRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    redisClient.on('error', (err) => {
      // Only log once to avoid spam
      if (!redisConnected) {
        console.warn('Redis connection error (caching disabled):', err.message);
        console.warn('The application will continue without Redis caching.');
        console.warn('To enable caching, start Redis: ./start-docker.sh');
      }
      redisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('✓ Redis Client Connected');
      redisConnected = true;
    });

    await redisClient.connect();
    redisConnected = true;
  } catch (error) {
    console.warn('Redis initialization failed (caching disabled):', error.message);
    console.warn('The application will continue without Redis caching.');
    console.warn('To enable caching, start Redis: ./start-docker.sh');
    redisClient = null;
    redisConnected = false;
  }
};

const getRedisClient = () => {
  if (!redisClient || !redisConnected) {
    return null; // Return null instead of throwing
  }
  return redisClient;
};

// Cache helper functions (gracefully handle Redis being unavailable)
const cacheGet = async (key) => {
  try {
    const client = getRedisClient();
    if (!client) return null; // Redis not available
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    // Silently fail - caching is optional
    return null;
  }
};

const cacheSet = async (key, value, expiration = 3600) => {
  try {
    const client = getRedisClient();
    if (!client) return; // Redis not available
    await client.setEx(key, expiration, JSON.stringify(value));
  } catch (error) {
    // Silently fail - caching is optional
  }
};

const cacheDelete = async (key) => {
  try {
    const client = getRedisClient();
    if (!client) return; // Redis not available
    await client.del(key);
  } catch (error) {
    // Silently fail - caching is optional
  }
};

const cacheDeletePattern = async (pattern) => {
  try {
    const client = getRedisClient();
    if (!client) return; // Redis not available
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (error) {
    // Silently fail - caching is optional
  }
};

module.exports = {
  initRedis,
  getRedisClient,
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheDeletePattern
};

