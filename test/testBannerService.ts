import { BannerServiceRedis } from "../src/bannerService";
import Banner from "../src/banner";

class MockRedisClient {
    private store: { [key: string]: string } = {};

    async setAsync(key: string, value: string): Promise<void> {
        this.store[key] = value;
    }

    async getAsync(key: string): Promise<string | null> {
        return this.store[key] || null;
    }

    async delAsync(key: string): Promise<void> {
        delete this.store[key];
    }

    async keysAsync(pattern: string): Promise<string[]> {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return Object.keys(this.store).filter((key) => regex.test(key));
    }

}

describe("BannerServiceRedis", () => {
    let service: BannerServiceRedis;
    let mockRedisClient: MockRedisClient;

    beforeEach(() => {
        mockRedisClient = new MockRedisClient();
        service = new BannerServiceRedis(0, "");
        (service as any).redisClient = mockRedisClient;
    });

    it("crud - create new banner", async () => {
        const banner = new Banner("1", new Date().toISOString, new Date().toISOString, "test message");
        await service.createBanner(banner);

        const storedBanner = await mockRedisClient.getAsync("banner:1");
        expect(storedBanner).toBe(JSON.stringify(banner));
    });

    it("crud - retrieve banner", async () => {
        const banner = new Banner("1", new Date().toISOString, new Date().toISOString, "test message");
        await mockRedisClient.setAsync("banner:1", JSON.stringify(banner));

        const retrievedBanner = await service.getBanner("1");
        expect(retrievedBanner).toEqual(banner);
    });

    it("crud - update banner", async () => {
        const banner = new Banner("1", new Date().toISOString, new Date().toISOString, "test message");
        await service.createBanner(banner);

        banner.message = "Updated message";
        await service.updateBanner("1", banner);

        const updateBanner = await mockRedisClient.getAsync("banner:1");
        expect(updateBanner).toBe(JSON.stringify(banner));
    });

    it("crud - delete banner", async () => {
        const banner = new Banner("1", new Date().toISOString, new Date().toISOString, "test message");
        await service.createBanner(banner);

        await service.deleteBanner("1");

        const deletedBanner = await mockRedisClient.getAsync("banner:1");
        expect(deletedBanner).toBeNull();
    });
});