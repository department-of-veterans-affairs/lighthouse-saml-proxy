import { BannerServiceRedis } from "./bannerService";
import { TestCache } from "./routes/types";
import Banner from "./banner";

describe("BannerServiceRedis", () => {
  let bannerService: BannerServiceRedis;
  let testCache: TestCache;

  beforeEach(() => {
    testCache = new TestCache();
    bannerService = new BannerServiceRedis(testCache);
  });
  it("create a banner", async () => {
    const banner = new Banner(
      "1",
      1625889231000,
      1625889231000,
      "test message",
      true,
      0,
      0
    );
    const result = await bannerService.createBanner(banner);
    expect(result).toEqual(banner);

    const retrievedBanner = await bannerService.getBanner(banner.id);
    expect(retrievedBanner).toBeDefined();
    expect(retrievedBanner!.id).toEqual(banner.id);
    expect(retrievedBanner!.message).toEqual(banner.message);
    expect(retrievedBanner!.enabled).toEqual(banner.enabled);
    expect(retrievedBanner!.alertStyle).toEqual(banner.alertStyle);
    expect(retrievedBanner!.order).toEqual(banner.order);
    expect(retrievedBanner!.startTime).toEqual(banner.startTime);
    expect(retrievedBanner!.endTime).toEqual(banner.endTime);
  });

  it("should retrieve a banner by id", async () => {
    const banner = new Banner(
      "2",
      1625889231000,
      1625889231000,
      "test message2",
      true,
      0,
      0
    );
    await bannerService.createBanner(banner);

    const retrievedBanner = await bannerService.getBanner(banner.id);
    expect(retrievedBanner).toBeDefined();
    expect(retrievedBanner!.id).toEqual(banner.id);
    expect(retrievedBanner!.message).toEqual(banner.message);
    expect(retrievedBanner!.enabled).toEqual(banner.enabled);
    expect(retrievedBanner!.alertStyle).toEqual(banner.alertStyle);
    expect(retrievedBanner!.order).toEqual(banner.order);
    expect(retrievedBanner!.startTime).toEqual(banner.startTime);
    expect(retrievedBanner!.endTime).toEqual(banner.endTime);
  });

  it("should retrieve all banners", async () => {
    const banner1 = new Banner(
      "3",
      1625889231000,
      1625889231000,
      "test message3",
      true,
      0,
      0
    );
    const banner2 = new Banner(
      "4",
      1625889231000,
      1625889231000,
      "test message4",
      true,
      0,
      0
    );

    await bannerService.createBanner(banner1);
    await bannerService.createBanner(banner2);

    const banners = await bannerService.getBanners();

    expect(banners.length).toBe(2);
  });

  it("should update banner", async () => {
    const banner = new Banner(
      "5",
      1625889231000,
      1625889231000,
      "test message5",
      true,
      0,
      0
    );
    await bannerService.createBanner(banner);

    const updatedBanner = new Banner(
      "6",
      1625889231000,
      1625889231000,
      "updatedbanner",
      true,
      0,
      0
    );
    const updateResult = await bannerService.updateBanner(
      banner.id,
      updatedBanner
    );
    expect(updateResult).toBeTruthy();

    const retrievedBanner = await bannerService.getBanner(banner.id);
    expect(retrievedBanner).toBeDefined();
    expect(retrievedBanner!.id).toEqual(updatedBanner.id);
    expect(retrievedBanner!.message).toEqual(updatedBanner.message);
    expect(retrievedBanner!.enabled).toEqual(updatedBanner.enabled);
    expect(retrievedBanner!.alertStyle).toEqual(updatedBanner.alertStyle);
    expect(retrievedBanner!.order).toEqual(updatedBanner.order);

    expect(retrievedBanner!.startTime).toEqual(updatedBanner.startTime);
    expect(retrievedBanner!.endTime).toEqual(updatedBanner.endTime);
  });
  it("should delete banner", async () => {
    const banner = new Banner(
      "6",
      1625889231000,
      1625889231000,
      "test message6",
      true,
      0,
      0
    );
    await bannerService.createBanner(banner);

    const deleteResult = await bannerService.deleteBanner(banner.id);
    expect(deleteResult).toBeTruthy();

    const retrievedBanner = await bannerService.getBanner(banner.id);
    expect(retrievedBanner).toBeNull();
  });
});
