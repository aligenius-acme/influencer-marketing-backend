import { Redis } from 'ioredis';
import { config } from './index.js';

let redisClient: Redis | null = null;

export const connectRedis = async (): Promise<Redis> => {
  try {
    const client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error('Redis connection failed after 3 retries');
          return null;
        }
        return Math.min(times * 100, 3000);
      },
    });

    client.on('error', (error: Error) => {
      console.error('Redis connection error:', error);
    });

    client.on('connect', () => {
      console.log('Redis client connected');
    });

    // Test connection
    await client.ping();

    redisClient = client;
    return client;
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    throw error;
  }
};

export const getRedisClient = (): Redis => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

export const disconnectRedis = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

// Cache helper functions
export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const client = getRedisClient();
  const data = await client.get(key);
  return data ? JSON.parse(data) : null;
};

export const cacheSet = async (
  key: string,
  value: unknown,
  ttlSeconds: number = 900
): Promise<void> => {
  const client = getRedisClient();
  await client.setex(key, ttlSeconds, JSON.stringify(value));
};

export const cacheDelete = async (key: string): Promise<void> => {
  const client = getRedisClient();
  await client.del(key);
};

export const cacheDeletePattern = async (pattern: string): Promise<void> => {
  const client = getRedisClient();
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(...keys);
  }
};
