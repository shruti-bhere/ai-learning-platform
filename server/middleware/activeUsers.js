const { getRedisClient, cacheSet, cacheGet, cacheDelete } = require('../config/redis');

const ACTIVE_USERS_KEY = 'active_users';
const ACTIVE_USERS_EXPIRY = 300; // 5 minutes

const trackActiveUsers = async (userId, isActive) => {
  try {
    const client = getRedisClient();
    if (!client) return; // Redis not available, skip tracking
    
    if (isActive) {
      // Store individual user activity
      await cacheSet(`active_user:${userId}`, { userId, timestamp: Date.now() }, ACTIVE_USERS_EXPIRY);
      
      // Add to active users set using Redis SET
      await client.sAdd(ACTIVE_USERS_KEY, userId.toString());
      await client.expire(ACTIVE_USERS_KEY, ACTIVE_USERS_EXPIRY);
    } else {
      await cacheDelete(`active_user:${userId}`);
      await client.sRem(ACTIVE_USERS_KEY, userId.toString());
    }
  } catch (error) {
    // Silently fail - active user tracking is optional
  }
};

const getActiveUsersCount = async () => {
  try {
    const client = getRedisClient();
    if (!client) return 0; // Redis not available
    // Get count from Redis SET
    const count = await client.sCard(ACTIVE_USERS_KEY);
    return count || 0;
  } catch (error) {
    return 0; // Return 0 if Redis unavailable
  }
};

module.exports = { trackActiveUsers, getActiveUsersCount };

