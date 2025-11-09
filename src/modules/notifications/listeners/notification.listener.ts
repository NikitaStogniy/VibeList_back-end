import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../services/notifications.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Follow } from '@database/entities';

export class UserFollowedEvent {
  followedUserId: string;
  followerId: string;
}

export class ItemReservedEvent {
  itemOwnerId: string;
  reserverId: string;
  itemId: string;
  itemName: string;
}

export class NewItemCreatedEvent {
  creatorId: string;
  itemId: string;
  itemName: string;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    private notificationsService: NotificationsService,
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
  ) {}

  @OnEvent('user.followed')
  async handleUserFollowed(event: UserFollowedEvent) {
    await this.notificationsService.createFollowerNotification(
      event.followedUserId,
      event.followerId,
    );
  }

  @OnEvent('item.reserved')
  async handleItemReserved(event: ItemReservedEvent) {
    await this.notificationsService.createItemReservedNotification(
      event.itemOwnerId,
      event.reserverId,
      event.itemId,
      event.itemName,
    );
  }

  @OnEvent('item.created')
  async handleNewItemCreated(event: NewItemCreatedEvent) {
    // Get all followers of the creator
    const followers = await this.followRepository.find({
      where: { followingId: event.creatorId },
      select: ['followerId'],
    });

    // Create notification for each follower
    for (const follow of followers) {
      await this.notificationsService.createNewItemNotification(
        follow.followerId,
        event.creatorId,
        event.itemId,
        event.itemName,
      );
    }
  }

  @OnEvent('item.unreserved')
  async handleItemUnreserved(event: { itemOwnerId: string; itemName: string }) {
    // Optional: notify owner that item was unreserved
    // Implementation depends on business requirements
  }
}
