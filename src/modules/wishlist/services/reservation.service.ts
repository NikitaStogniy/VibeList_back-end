import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WishlistItem } from '@database/entities/wishlist-item.entity';

@Injectable()
export class ReservationService {
  constructor(
    @InjectRepository(WishlistItem)
    private wishlistRepository: Repository<WishlistItem>,
    private eventEmitter: EventEmitter2,
  ) {}

  async reserveItem(itemId: string, userId: string): Promise<WishlistItem> {
    const item = await this.wishlistRepository.findOne({
      where: { id: itemId },
      relations: ['user'],
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    // Cannot reserve your own item
    if (item.userId === userId) {
      throw new BadRequestException('Cannot reserve your own wishlist item');
    }

    // Cannot reserve private items
    if (!item.isPublic) {
      throw new ForbiddenException('Cannot reserve a private item');
    }

    // Check if already reserved
    if (item.reservedBy) {
      throw new BadRequestException('Item is already reserved');
    }

    item.reservedBy = userId;
    item.reservedAt = new Date();

    await this.wishlistRepository.save(item);

    // Emit event for item reservation
    this.eventEmitter.emit('item.reserved', {
      itemOwnerId: item.userId,
      reserverId: userId,
      itemId: item.id,
      itemName: item.name,
    });

    // Reload from database to ensure @AfterLoad() hook sets isReserved correctly
    const updatedItem = await this.wishlistRepository.findOne({
      where: { id: itemId },
      relations: ['user'],
    });

    if (!updatedItem) {
      throw new NotFoundException('Wishlist item not found after update');
    }

    return updatedItem;
  }

  async unreserveItem(itemId: string, userId: string): Promise<WishlistItem> {
    const item = await this.wishlistRepository.findOne({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    // Check if item is reserved
    if (!item.reservedBy) {
      throw new BadRequestException('Item is not reserved');
    }

    // Only the person who reserved it or the owner can unreserve
    if (item.reservedBy !== userId && item.userId !== userId) {
      throw new ForbiddenException('You do not have permission to unreserve this item');
    }

    item.reservedBy = undefined;
    item.reservedAt = undefined;

    await this.wishlistRepository.save(item);

    // Emit event for item unreservation
    this.eventEmitter.emit('item.unreserved', {
      itemOwnerId: item.userId,
      itemName: item.name,
    });

    // Reload from database to ensure @AfterLoad() hook sets isReserved correctly
    const updatedItem = await this.wishlistRepository.findOne({
      where: { id: itemId },
    });

    if (!updatedItem) {
      throw new NotFoundException('Wishlist item not found after update');
    }

    return updatedItem;
  }

  async getReservedItems(userId: string) {
    const items = await this.wishlistRepository.find({
      where: { reservedBy: userId },
      relations: ['user'],
      order: { reservedAt: 'DESC' },
    });

    return {
      items,
      total: items.length,
    };
  }

  async getItemsReservedByOthers(userId: string) {
    const queryBuilder = this.wishlistRepository
      .createQueryBuilder('item')
      .leftJoinAndSelect('item.reservedByUser', 'reserver')
      .where('item.userId = :userId', { userId })
      .andWhere('item.reservedBy IS NOT NULL')
      .orderBy('item.reservedAt', 'DESC');

    const items = await queryBuilder.getMany();

    return {
      items,
      total: items.length,
    };
  }
}
