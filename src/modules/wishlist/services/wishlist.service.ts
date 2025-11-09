import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WishlistItem, ItemPriority } from '@database/entities/wishlist-item.entity';
import { CreateItemDto } from '../dto/create-item.dto';
import { UpdateItemDto } from '../dto/update-item.dto';
import { FilterItemsDto } from '../dto/filter-items.dto';
import { CreateItemFromUrlDto } from '../dto/create-item-from-url.dto';
import { ParserGatewayService } from './parser-gateway.service';
import { ParserJobResult } from '../../../config/queue.config';

@Injectable()
export class WishlistService {
  private readonly logger = new Logger(WishlistService.name);

  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepository: Repository<WishlistItem>,
    private parserGatewayService: ParserGatewayService,
    private eventEmitter: EventEmitter2,
  ) {}

  async createItem(userId: string, createDto: CreateItemDto): Promise<WishlistItem> {
    const item = this.wishlistRepository.create({
      userId,
      ...createDto,
      priority: createDto.priority || ItemPriority.MEDIUM,
      isPublic: createDto.isPublic !== undefined ? createDto.isPublic : true,
    });

    const savedItem = await this.wishlistRepository.save(item);

    // Emit event for new item creation
    if (savedItem.isPublic) {
      this.eventEmitter.emit('item.created', {
        creatorId: userId,
        itemId: savedItem.id,
        itemName: savedItem.name,
      });
    }

    return savedItem;
  }

  async findUserItems(userId: string, filterDto: FilterItemsDto) {
    const { priority, isReserved, search, limit = 20, offset = 0 } = filterDto;

    const queryBuilder = this.wishlistRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId });

    // Apply filters
    if (priority) {
      queryBuilder.andWhere('item.priority = :priority', { priority });
    }

    if (isReserved !== undefined) {
      if (isReserved) {
        queryBuilder.andWhere('item.reservedBy IS NOT NULL');
      } else {
        queryBuilder.andWhere('item.reservedBy IS NULL');
      }
    }

    if (search) {
      queryBuilder.andWhere('item.name ILIKE :search', { search: `%${search}%` });
    }

    // Pagination
    queryBuilder
      .orderBy('item.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      hasMore: offset + limit < total,
    };
  }

  async findPublicUserItems(userId: string, filterDto: FilterItemsDto) {
    const { priority, isReserved, search, limit = 20, offset = 0 } = filterDto;

    const queryBuilder = this.wishlistRepository
      .createQueryBuilder('item')
      .where('item.userId = :userId', { userId })
      .andWhere('item.isPublic = :isPublic', { isPublic: true });

    if (priority) {
      queryBuilder.andWhere('item.priority = :priority', { priority });
    }

    if (isReserved !== undefined) {
      if (isReserved) {
        queryBuilder.andWhere('item.reservedBy IS NOT NULL');
      } else {
        queryBuilder.andWhere('item.reservedBy IS NULL');
      }
    }

    if (search) {
      queryBuilder.andWhere('item.name ILIKE :search', { search: `%${search}%` });
    }

    queryBuilder
      .orderBy('item.createdAt', 'DESC')
      .take(limit)
      .skip(offset);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      total,
      hasMore: offset + limit < total,
    };
  }

  async findItemById(itemId: string): Promise<WishlistItem> {
    const item = await this.wishlistRepository.findOne({
      where: { id: itemId },
      relations: ['user', 'reservedByUser'],
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    return item;
  }

  async updateItem(itemId: string, userId: string, updateDto: UpdateItemDto): Promise<WishlistItem> {
    const item = await this.findItemById(itemId);

    // Ensure user owns the item
    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have permission to update this item');
    }

    // Cannot update if reserved
    if (item.reservedBy) {
      throw new BadRequestException('Cannot update a reserved item');
    }

    const wasPublic = item.isPublic;
    Object.assign(item, updateDto);

    const updatedItem = await this.wishlistRepository.save(item);

    // Note: Feed cache invalidation happens automatically via FeedCacheService
    // No need to manually invalidate here

    return updatedItem;
  }

  async deleteItem(itemId: string, userId: string): Promise<void> {
    const item = await this.findItemById(itemId);

    if (item.userId !== userId) {
      throw new ForbiddenException('You do not have permission to delete this item');
    }

    // Cannot delete if reserved
    if (item.reservedBy) {
      throw new BadRequestException('Cannot delete a reserved item. Please unreserve it first.');
    }

    await this.wishlistRepository.remove(item);

    // Note: Feed cache invalidation happens automatically via FeedCacheService
  }

  async getItemStats(userId: string) {
    const totalItems = await this.wishlistRepository.count({
      where: { userId },
    });

    const reservedItems = await this.wishlistRepository.count({
      where: {
        userId,
        reservedBy: Not(IsNull()),
      },
    });

    const priorityCounts = await this.wishlistRepository
      .createQueryBuilder('item')
      .select('item.priority', 'priority')
      .addSelect('COUNT(*)', 'count')
      .where('item.userId = :userId', { userId })
      .groupBy('item.priority')
      .getRawMany();

    return {
      totalItems,
      reservedItems,
      availableItems: totalItems - reservedItems,
      priorityCounts: priorityCounts.reduce((acc, row) => {
        acc[row.priority] = parseInt(row.count);
        return acc;
      }, {}),
    };
  }

  /**
   * Create wishlist item from URL
   * Parses the URL and auto-fills item data
   */
  async createItemFromUrl(
    userId: string,
    createDto: CreateItemFromUrlDto,
  ): Promise<{ item: WishlistItem; warnings?: string[] }> {
    this.logger.log(`Creating item from URL for user ${userId}: ${createDto.url}`);

    // Create initial item with minimal data
    const item = this.wishlistRepository.create({
      userId,
      productUrl: createDto.url,
      priority: createDto.priority || ItemPriority.MEDIUM,
      isPublic: createDto.isPublic !== undefined ? createDto.isPublic : true,
      parsingEnabled: false, // Will enable after successful parse with price
      parsingFailedCount: 0,
    });

    const savedItem = await this.wishlistRepository.save(item);

    try {
      // Parse URL synchronously
      const parsingResult = await this.parserGatewayService.parseUrlSync(
        createDto.url,
        userId,
        30000, // 30 seconds timeout
      );

      // Update item with parsed data
      await this.updateItemFromParsingResult(savedItem.id, parsingResult);

      // Fetch updated item
      const updatedItem = await this.findItemById(savedItem.id);

      // Emit event for new item creation
      if (updatedItem.isPublic) {
        this.eventEmitter.emit('item.created', {
          creatorId: userId,
          itemId: updatedItem.id,
          itemName: updatedItem.name,
        });
      }

      return {
        item: updatedItem,
        warnings: parsingResult.warnings,
      };
    } catch (error) {
      this.logger.error(`Failed to parse URL: ${error.message}`);
      // Keep the item but mark parsing as failed
      savedItem.parsingFailedCount = 1;
      savedItem.parsingEnabled = false;
      await this.wishlistRepository.save(savedItem);

      throw new BadRequestException(
        `Failed to parse URL: ${error.message}. Please fill in item details manually.`,
      );
    }
  }

  /**
   * Update wishlist item from parsing result
   */
  async updateItemFromParsingResult(
    itemId: string,
    parsingResult: ParserJobResult,
  ): Promise<void> {
    const item = await this.findItemById(itemId);

    if (parsingResult.success && parsingResult.data) {
      const data = parsingResult.data;

      // Update fields from parsing
      if (data.title) item.name = data.title;
      if (data.description) item.description = data.description;
      if (data.price !== undefined && data.price !== null) {
        item.price = data.price;
        item.currency = data.currency || 'USD';
      }
      if (data.imageUrl) item.imageUrl = data.imageUrl;
      if (data.category) item.category = data.category;

      // Enable parsing only if we have a price
      item.parsingEnabled = !!item.price;
      item.lastParsedAt = new Date();
      item.parsingFailedCount = 0;

      await this.wishlistRepository.save(item);
      this.logger.log(`Updated item ${itemId} from parsing result. Parsing enabled: ${item.parsingEnabled}`);
    } else {
      throw new Error('Parsing was not successful');
    }
  }

  /**
   * Get items that need nightly price check
   */
  async getItemsForNightlyParsing(): Promise<WishlistItem[]> {
    return await this.wishlistRepository.find({
      where: {
        parsingEnabled: true,
      },
      select: ['id', 'productUrl', 'price', 'currency', 'userId', 'name'],
    });
  }
}
