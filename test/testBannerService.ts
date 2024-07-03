import { BannerServiceRedis } from "../src/bannerService";
import { TestCache } from "../src/routes/types";
import Banner from "../src/banner";

describe('BannerServiceRedis', () => {
    let bannerService: BannerServiceRedis;
    let testCache: TestCache;

    beforeEach(() => {
        testCache = new TestCache();
        bannerService = new BannerServiceRedis(testCache);
    });

    it('create a banner', async () => {
        const banner = new Banner("1", new Date(), new Date(), "test message", true, 0, 0);
        const result = await bannerService.createBanner(banner);
        expect(result).toEqual(banner);

        const retrievedBanner = await bannerService.getBanner(banner.id);
        expect(retrievedBanner).toEqual(banner);
    });

    it('retrieve a banner by id', async () => {
        const banner = new Banner("2", new Date(), new Date(), "test message2", true, 0, 0);
        await bannerService.createBanner(banner);

        const retrievedBanner = await bannerService.getBanner(banner.id);
        expect(retrievedBanner).toEqual(banner);
    });

    it('retrieve all banners', async () => {
        const banner1 = new Banner("3", new Date(), new Date(), "test message3", true, 0, 0);
        const banner2 = new Banner("4", new Date(), new Date(), "test message4", true, 0, 0);

        await bannerService.createBanner(banner1);
        await bannerService.createBanner(banner2);

        const banners = await bannerService.getBanners();
        expect(banners).toEqual([banner1, banner2]);
    });

    it('update banner', async () => {
        const banner = new Banner("5", new Date(), new Date(), "test message5", true, 0, 0);
        await bannerService.createBanner(banner);

        const updatedBanner = new Banner("5", new Date(), new Date(), "updatedbanner", true, 0, 0);
        await bannerService.updateBanner(banner.id, updatedBanner);

        const retrievedBanner = await bannerService.getBanner(banner.id);
        expect(retrievedBanner).toEqual(updatedBanner);
    });
    it('delete banner', async () => {
        const banner = new Banner("6", new Date(), new Date(), "test message6", true, 0, 0);
        await bannerService.createBanner(banner);

        await bannerService.deleteBanner(banner.id);
        const retrievedBanner = await bannerService.getBanner(banner.id);
        expect(retrievedBanner).toBeNull();
    });

})
