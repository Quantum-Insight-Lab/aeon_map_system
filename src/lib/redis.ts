import { createClient } from 'redis';

export type AppRedis = ReturnType<typeof createClient>;

export async function connectRedis(url: string): Promise<AppRedis> {
  const redis = createClient({ url });
  redis.on('error', (err) => console.error('RedisClient', err));
  await redis.connect();
  return redis;
}
