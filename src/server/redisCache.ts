import Redis from "ioredis";

class RedisCache {
  private readonly redisClient: Redis.Redis;

  constructor() {
    this.redisClient = new Redis({
      port: 6379,
      host: "127.0.0.1",
    });

    //TODO use this as the this.redisClient instead ot the one above?
    // see https://github.com/arjunmehta/node-georedis for more infos
    //const geoRedisClient = geoRedis.initialize(this.redisClient);

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

  cacheData(key: string, value: string, expiryTime: number): void {
    //TODO use hset instead to store as a hash for performance reasons
    this.redisClient.setex(key, expiryTime, value);
  }
}

export default new RedisCache();
