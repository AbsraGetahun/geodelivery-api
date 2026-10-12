import redis from './client.js';

/**
 * Generic cache helpers implementing the Cache-Aside pattern.
 * All functions fail-open (never throw errors or crash caller if Redis is down).
 */

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (data === null) {
      console.log(`[cache] MISS ${key}`);
      return null;
    }
    console.log(`[cache] HIT ${key}`);
    return JSON.parse(data) as T;
  } catch (err) {
    console.error(`[cache] Error reading key ${key}:`, err);
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttlSeconds, serialized);
    console.log(`[cache] SET ${key} (TTL ${ttlSeconds}s)`);
  } catch (err) {
    console.error(`[cache] Error setting key ${key}:`, err);
  }
}

export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const deletedCount = await redis.del(...keys);
    console.log(`[cache] DEL ${deletedCount} key(s): ${keys.join(', ')}`);
  } catch (err) {
    console.error(`[cache] Error deleting keys ${keys.join(', ')}:`, err);
  }
}

export async function cacheDelPattern(pattern: string): Promise<void> {
  try {
    let cursor = '0';
    let totalDeleted = 0;

    do {
      // Use SCAN with MATCH and COUNT to safely iterate keys in batches without blocking Redis
      const [nextCursor, matchedKeys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (matchedKeys.length > 0) {
        const deleted = await redis.del(...matchedKeys);
        totalDeleted += deleted;
      }
    } while (cursor !== '0');

    console.log(`[cache] DEL PATTERN '${pattern}' deleted ${totalDeleted} key(s)`);
  } catch (err) {
    console.error(`[cache] Error deleting pattern '${pattern}':`, err);
  }
}
