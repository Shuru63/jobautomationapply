import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const globalForRedis = globalThis as typeof globalThis & {
  __jobAgentRedis?: Redis;
  __jobAgentRedisFailed?: boolean;
};

export function getRedis(): Redis {
  if (!globalForRedis.__jobAgentRedis && !globalForRedis.__jobAgentRedisFailed) {
    try {
      globalForRedis.__jobAgentRedis = new Redis(REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy(times) {
          if (times > 2) {
            globalForRedis.__jobAgentRedisFailed = true;
            return null;
          }
          return Math.min(times * 200, 1000);
        },
        lazyConnect: true,
      });
    } catch {
      globalForRedis.__jobAgentRedisFailed = true;
    }
  }
  return globalForRedis.__jobAgentRedis!;
}

export function isRedisAvailable(): boolean {
  return !globalForRedis.__jobAgentRedisFailed;
}