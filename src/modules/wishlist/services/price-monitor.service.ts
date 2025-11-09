import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistItem } from '@database/entities/wishlist-item.entity';
import { ParserGatewayService } from './parser-gateway.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { FollowService } from '../../users/follow.service';

@Injectable()
export class PriceMonitorService {
  private readonly logger = new Logger(PriceMonitorService.name);
  private readonly MAX_FAILED_ATTEMPTS = 5;

  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepository: Repository<WishlistItem>,
    private parserGatewayService: ParserGatewayService,
    private notificationsService: NotificationsService,
    private followService: FollowService,
  ) {}

  /**
   * Check price for a single item
   */
  async checkPriceUpdate(itemId: string): Promise<void> {
    const item = await this.wishlistRepository.findOne({
      where: { id: itemId },
    });

    if (!item || !item.parsingEnabled || !item.productUrl || !item.price) {
      this.logger.warn(`Item ${itemId} is not eligible for price monitoring`);
      return;
    }

    this.logger.log(`Checking price for item ${itemId}: ${item.name}`);

    try {
      // Parse the URL to get current price
      const parsingResult = await this.parserGatewayService.parseUrlSync(
        item.productUrl,
        item.userId,
        30000,
      );

      if (!parsingResult.success || !parsingResult.data?.price) {
        throw new Error('Failed to parse price from URL');
      }

      const newPrice = parsingResult.data.price;
      const newCurrency = parsingResult.data.currency || item.currency;
      const oldPrice = Number(item.price);

      // Update last parsed timestamp
      item.lastParsedAt = new Date();

      // Check if price changed
      if (Math.abs(newPrice - oldPrice) > 0.01) {
        // Price changed
        this.logger.log(
          `Price changed for ${item.name}: ${oldPrice} ${item.currency} → ${newPrice} ${newCurrency}`,
        );

        // Update price in database
        item.price = newPrice;
        item.currency = newCurrency;
        item.parsingFailedCount = 0;

        await this.wishlistRepository.save(item);

        // If price dropped, notify followers
        if (newPrice < oldPrice) {
          this.logger.log(`Price dropped! Sending notifications to followers`);
          await this.notifyFollowersOfPriceDrop(
            item.userId,
            itemId,
            item.name || 'Item',
            oldPrice,
            newPrice,
            newCurrency || 'USD',
          );
        } else {
          this.logger.log(`Price increased, no notifications sent`);
        }
      } else {
        // Price unchanged
        this.logger.log(`Price unchanged for ${item.name}`);
        item.parsingFailedCount = 0;
        await this.wishlistRepository.save(item);
      }
    } catch (error) {
      this.logger.error(`Failed to check price for item ${itemId}: ${error.message}`);

      // Increment failed count
      item.parsingFailedCount = (item.parsingFailedCount || 0) + 1;

      // Disable parsing if too many failures
      if (item.parsingFailedCount >= this.MAX_FAILED_ATTEMPTS) {
        this.logger.warn(
          `Disabling price monitoring for item ${itemId} after ${item.parsingFailedCount} failures`,
        );
        item.parsingEnabled = false;
      }

      await this.wishlistRepository.save(item);
    }
  }

  /**
   * Notify followers about price drop
   */
  private async notifyFollowersOfPriceDrop(
    itemOwnerId: string,
    itemId: string,
    itemName: string,
    oldPrice: number,
    newPrice: number,
    currency: string,
  ): Promise<void> {
    try {
      // Get all followers of the item owner
      const followerIds = await this.followService.getFollowerIds(itemOwnerId);

      if (followerIds.length === 0) {
        this.logger.log('No followers to notify');
        return;
      }

      // Send notifications
      await this.notificationsService.createPriceDropNotifications(
        followerIds,
        itemOwnerId,
        itemId,
        itemName,
        oldPrice,
        newPrice,
        currency,
      );
    } catch (error) {
      this.logger.error(`Failed to notify followers: ${error.message}`);
    }
  }

  /**
   * Process all items that need nightly price check
   * Processes in batches to avoid overloading the system
   */
  async processNightlyPriceChecks(batchSize: number = 50): Promise<void> {
    this.logger.log('Starting nightly price checks...');

    const items = await this.wishlistRepository.find({
      where: { parsingEnabled: true },
      select: ['id', 'name', 'productUrl', 'price'],
    });

    this.logger.log(`Found ${items.length} items to check`);

    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      this.logger.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

      // Process batch in parallel
      await Promise.allSettled(
        batch.map((item) => this.checkPriceUpdate(item.id)),
      );

      // Small delay between batches to avoid overloading parsers
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.logger.log('Nightly price checks completed');
  }
}
