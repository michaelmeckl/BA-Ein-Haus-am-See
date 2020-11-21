import Redis from "ioredis";
import JSONCache from "redis-json";
import { Config } from "../shared/config";

class RedisCache {
  private readonly redisClient: Redis.Redis;
  private jsonCache: JSONCache;

  constructor() {
    this.redisClient = new Redis({
      port: Config.REDIS_PORT,
      host: "127.0.0.1",
    });

    this.jsonCache = new JSONCache(this.redisClient, { prefix: "cache: " });

    //? use this as the this.redisClient instead ot the one above?
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

  async fetchDataFromCache(key: string): Promise<Partial<any> | undefined> {
    try {
      //const result = await this.redisClient.get(key);
      const result = await this.jsonCache.get(key);
      return result;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  cacheData(key: string, value: string, expiryTime: number): void {
    //this.redisClient.setex(key, expiryTime, value);
    this.jsonCache.set(key, value, { expire: expiryTime });
  }
}

export default new RedisCache();
