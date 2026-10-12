import 'dotenv/config';
import { Redis } from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6380';

const redis = new Redis(redisUrl, {
  lazyConnect: false,
});

redis.on('connect', () => {
  console.log('[redis] Connected to Redis at ' + redisUrl);
});

redis.on('error', (err: unknown) => {
  console.error('[redis] Redis error:', err);
});

export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    console.log('[redis] Connection closed gracefully');
  } catch (err) {
    console.error('[redis] Error closing connection:', err);
  }
}

export default redis;
