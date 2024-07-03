import Banner from "./banner";
import { ICache } from "./routes/types";

export interface BannerService {
  getBanner(id: string): Promise<Banner | null>;
  getBanners(): Promise<Banner[]>;
  createBanner(banner: Banner): Promise<Banner | null>;
  updateBanner(id: string, banner: Banner): Promise<void>;
  deleteBanner(id: string): Promise<void>;
}

export class BannerServiceRedis implements BannerService {
  private cache: ICache;

  constructor(cache: ICache) {
    this.cache = cache;
  }

  generateKey(id: string): string {
    return `banner:${id}`;
  }

  async getBanner(id: string): Promise<Banner | null> {
    try {
      const bannerData = await this.cache.get(this.generateKey(id));
      if (!bannerData) {
        return null;
      }
      const banner = JSON.parse(bannerData) as Banner;
      return banner;
    } catch (error) {
      console.error("Error retrieving banner:", error);
      return null;
    }
  }

  //can only use the get if we want to retreive individual banners when you know IDS
  //we will need a new keys function to get all banners without knowing the IDS
  async getBanners(): Promise<Banner[]> {
    try {
      const keys = await this.cache.keys("banner:");
      const bannerPromises = keys.map(async (key) => {
        const bannerData = await this.cache.get(key);
        return JSON.parse(bannerData) as Banner;
      });
      const banners = await Promise.all(bannerPromises);
      return banners;
    } catch (error) {
      console.error("Error retrieving banners from cache:", error);
      return [];
    }
  }

  async createBanner(banner: Banner): Promise<Banner | null> {
    try {
      const key = this.generateKey(banner.id);
      const value = JSON.stringify(banner);
      await this.cache.set(key, value);
      return banner;
    } catch (error) {
      console.error("Error creating banner:", error);
      return null;
    }
  }

  async updateBanner(id: string, banner: Banner): Promise<void> {
    try {
      const key = this.generateKey(id);
      const value = JSON.stringify(banner);
      await this.cache.set(key, value);
    } catch (error) {
      console.error("Error updating banner:", error);
    }
  }

  async deleteBanner(id: string): Promise<void> {
    try {
      const key = this.generateKey(id);
      await this.cache.delete(key);
    } catch (error) {
      console.error("Error deleting banner:", error);
    }
  }
}
