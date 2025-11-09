import { Injectable, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class FeedCacheService {
  private readonly logger = new Logger(FeedCacheService.name);
  private readonly FEED_CACHE_PREFIX = 'feed:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  private getFeedCacheKey(userId: string, sortBy: string): string {
    return `${this.FEED_CACHE_PREFIX}${userId}:${sortBy}`;
  }

  async getFeed(userId: string, sortBy: string): Promise<any | null> {
    const key = this.getFeedCacheKey(userId, sortBy);
    return await this.cacheManager.get(key);
  }

  async setFeed(userId: string, sortBy: string, data: any): Promise<void> {
    const key = this.getFeedCacheKey(userId, sortBy);
    await this.cacheManager.set(key, data, this.CACHE_TTL * 1000);
  }

  async invalidateUserFeed(userId: string): Promise<void> {
    const keys = [
      this.getFeedCacheKey(userId, 'recent'),
      this.getFeedCacheKey(userId, 'priority'),
    ];

    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }

  async invalidateFollowerFeeds(followerIds: string[]): Promise<void> {
    const keys = followerIds.flatMap(id => [
      this.getFeedCacheKey(id, 'recent'),
      this.getFeedCacheKey(id, 'priority'),
    ]);

    await Promise.all(keys.map(key => this.cacheManager.del(key)));
  }
}
