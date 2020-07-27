//import redis from "redis";
import Redis from "ioredis";

class RedisCache {
  private readonly redisClient: Redis.Redis;

  constructor() {
    this.redisClient = new Redis({
      port: 6379,
      host: "127.0.0.1",
    });

    this.redisClient.on("connect", function () {
      console.log("Connected to redis instance");
    });

    this.redisClient.on("ready", function () {
      console.log("Redis instance is ready (data loaded from disk)");
    });

    // Handles redis connection temporarily going down without app crashing
    // If an error is handled here, then redis will attempt to retry the request based on maxRetriesPerRequest
    this.redisClient.on("error", function (e) {
      console.error(`Error connecting to redis: "${e}"`);
    });

    /*
    this.redisClient = redis.createClient(6379);

    this.redisClient.on("error", function (error: any) {
      console.error(error);
    });
    */
  }

  async fetchDataFromCache(key: string): Promise<string | null> {
    try {
      const result = await this.redisClient.get(key);
      return result;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  cacheData(key: string, value: string): void {
    const expiryTime = 86400; // in seconds: 86400s == 1 day
    this.redisClient.setex(key, expiryTime, value);
  }
}

export default new RedisCache();
