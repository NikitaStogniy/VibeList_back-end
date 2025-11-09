import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WishlistItem, Follow, User } from '@database/entities';
import { FeedCacheService } from './feed-cache.service';
import { GetFeedDto, FeedSortBy } from '../dto/get-feed.dto';
import { FeedItemResponseDto } from '../dto/feed-item-response.dto';

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepository: Repository<WishlistItem>,
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private feedCacheService: FeedCacheService,
  ) {}

  async getUserFeed(userId: string, getFeedDto: GetFeedDto) {
    const { limit = 20, offset = 0, sortBy = FeedSortBy.RECENT } = getFeedDto;

    // Try to get from cache first
    const cacheKey = `${userId}:${sortBy}`;
    const cachedFeed = await this.feedCacheService.getFeed(userId, sortBy);

    if (cachedFeed) {
      // Return paginated results from cache
      const items = cachedFeed.slice(offset, offset + limit);
      return {
        items,
        total: cachedFeed.length,
        hasMore: offset + limit < cachedFeed.length,
      };
    }

    // Get list of users that the current user follows
    const following = await this.followRepository.find({
      where: { followerId: userId },
      select: ['followingId'],
    });

    // Include current user's ID to show their own items in the feed
    const followingIds = [
      userId, // Add current user to see their own items
      ...following.map(f => f.followingId)
    ];

    // Remove duplicates in case user somehow follows themselves
    const uniqueFollowingIds = [...new Set(followingIds)];

    // Build query
    const queryBuilder = this.wishlistRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.user', 'user')
      .where('item.userId IN (:...followingIds)', { followingIds: uniqueFollowingIds })
      .andWhere('item.isPublic = :isPublic', { isPublic: true });

    // Apply sorting
    if (sortBy === FeedSortBy.PRIORITY) {
      queryBuilder
        .orderBy('item.priority', 'DESC')
        .addOrderBy('item.createdAt', 'DESC');
    } else {
      queryBuilder.orderBy('item.createdAt', 'DESC');
    }

    // Get all items for caching
    const allItems = await queryBuilder.getMany();

    // Transform to response DTOs
    const feedItems = allItems.map(item => this.transformToFeedItem(item, userId));

    // Cache the results
    await this.feedCacheService.setFeed(userId, sortBy, feedItems);

    // Return paginated results
    const items = feedItems.slice(offset, offset + limit);

    return {
      items,
      total: feedItems.length,
      hasMore: offset + limit < feedItems.length,
    };
  }

  async invalidateFeedForNewItem(userId: string): Promise<void> {
    // Get all followers of the user who created the item
    const followers = await this.followRepository.find({
      where: { followingId: userId },
      select: ['followerId'],
    });

    // Include the user themselves (their own feed needs invalidation)
    const followerIds = [
      userId, // User's own feed
      ...followers.map(f => f.followerId)
    ];

    // Invalidate cache for all followers (including the user themselves)
    await this.feedCacheService.invalidateFollowerFeeds(followerIds);
  }

  async invalidateFeedForUser(userId: string): Promise<void> {
    await this.feedCacheService.invalidateUserFeed(userId);
  }

  private transformToFeedItem(item: WishlistItem, currentUserId: string): FeedItemResponseDto {
    return {
      wishlistItem: {
        id: item.id,
        userId: item.userId,
        name: item.name,
        description: item.description,
        price: item.price ? parseFloat(item.price.toString()) : undefined,
        currency: item.currency,
        productUrl: item.productUrl,
        imageUrl: item.imageUrl,
        priority: item.priority,
        isReserved: !!item.reservedBy,
        reservedBy: item.reservedBy,
        reservedAt: item.reservedAt,
        isPublic: item.isPublic,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      },
      user: {
        id: item.user.id,
        username: item.user.username,
        displayName: item.user.displayName,
        avatarUrl: item.user.avatarUrl,
      },
      isFollowing: item.userId !== currentUserId,
    };
  }
}
