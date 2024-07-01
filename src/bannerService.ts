import { promisify } from "util";
import  Banner from "./banner";
import Redis, { RedisClient } from "redis";

interface IRedisClient {
    setAsync(key: string, value: string): Promise<void>;
    getAsync(key: string): Promise<string | null>;
    delAsync(key: string): Promise<void>;
    keysAsync(pattern: string): Promise<string[]>;
}

class RedisClientAdapter implements IRedisClient {
    private client: RedisClient;

    constructor(redisPort: number, redisHost: string) {
        this.client = Redis.createClient(redisPort, redisHost);
    }

    setAsync(key: string, value: string): Promise<void> {
        const setAsync = promisify(this.client.set).bind(this.client) as (key: string, value: string) => Promise<void>;
        return setAsync(key, value);
    }

    getAsync(key: string): Promise<string | null> {
        const getAsync = promisify(this.client.get).bind(this.client) as (key: string) => Promise<string | null>;
        return getAsync(key);
    }

    delAsync(key: string): Promise<void> {
        const delAsync = promisify<string, number>(this.client.del).bind(this.client);
        return delAsync(key).then(() => {});
    }

    keysAsync(pattern: string): Promise<string[]> {
        const keysAsync = promisify(this.client.keys).bind(this.client) as (pattern: string) => Promise<string[]>;
        return keysAsync(pattern);
    }
}

export interface BannerService {
    getBanner(id: string): Promise<Banner | null>;
    createBanner(banner: Banner): Promise<void>;
    updateBanner(id: string, banner: Banner): Promise<void>;
    deleteBanner(id: string): Promise<void>;

}

export class BannerServiceRedis implements BannerService {
    private redisClient: RedisClientAdapter;

    constructor(redisPort: number, redisHost: string) {
        this.redisClient = new RedisClientAdapter(redisPort, redisHost);
    }

    async getBanner(id: string): Promise<Banner | null> {
        try {
            const bannerData = await this.redisClient.getAsync(`banner:${id}`);
            if(!bannerData) {
                return null;
            }
            const banner = JSON.parse(bannerData) as Banner;
            return banner;
        } catch (error) {
            console.error("Error retrieving banner from Redis:", error);
            return null;
        }
    }

    async createBanner(banner: Banner): Promise<void> {
        try {
            const key = `banner:${banner.id}`;
            const value = JSON.stringify(banner);
            await this.redisClient.setAsync(key,value);
        } catch (error) {
            console.error("Error creating banner in Redis:", error);
        }
    }

    async updateBanner(id: string, banner: Banner): Promise<void> {
        try {
            const key = `banner:${id}`;
            const value = JSON.stringify(banner);
            await this.redisClient.setAsync(key, value)

        } catch (error) {
            console.error("Error updating banner in Redis:", error);
        }
    }

    async deleteBanner(id: string): Promise<void> {
        try {
            const key = `banner:${id}`;
            await this.redisClient.delAsync(key);
        } catch (error) {
            console.error("Error deleting banner from Redis:", error);
        }
    }
}


