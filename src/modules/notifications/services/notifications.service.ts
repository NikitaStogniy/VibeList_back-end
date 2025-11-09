import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType, User, DeviceToken } from '@database/entities';
import { CreateNotificationDto } from '../dto/create-notification.dto';
import { GetNotificationsDto } from '../dto/get-notifications.dto';
import { FCMService } from './fcm.service';
import { EmailService } from './email.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
    private fcmService: FCMService,
    private emailService: EmailService,
    private eventEmitter: EventEmitter2,
  ) {}

  async create(createDto: CreateNotificationDto): Promise<Notification> {
    const notification = this.notificationRepository.create(createDto);
    const savedNotification = await this.notificationRepository.save(notification);

    // Trigger push and email notifications
    await this.sendPushNotification(savedNotification);
    await this.sendEmailNotification(savedNotification);

    return savedNotification;
  }

  async getUserNotifications(
    userId: string,
    getNotificationsDto: GetNotificationsDto,
  ) {
    const limit = getNotificationsDto.limit || 20;
    const offset = getNotificationsDto.offset || 0;

    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      relations: ['actor'],
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    return {
      notifications,
      total,
      hasMore: offset + limit < total,
      unreadCount: await this.getUnreadCount(userId),
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.update(
      { id: notificationId, userId },
      { isRead: true },
    );
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }

  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepository.delete({ id: notificationId, userId });
  }

  private async sendPushNotification(notification: Notification): Promise<void> {
    // Get user's device tokens
    const deviceTokens = await this.deviceTokenRepository.find({
      where: { userId: notification.userId },
    });

    if (deviceTokens.length === 0) {
      return;
    }

    const tokens = deviceTokens.map(dt => dt.token);

    await this.fcmService.sendToMultipleDevices(
      tokens,
      notification.title,
      notification.body,
      {
        notificationId: notification.id,
        type: notification.type,
        ...(notification.data || {}),
      },
    );
  }

  private async sendEmailNotification(notification: Notification): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: notification.userId },
    });

    if (!user || !user.email) {
      return;
    }

    switch (notification.type) {
      case NotificationType.NEW_FOLLOWER:
        if (notification.actorId) {
          const actor = await this.userRepository.findOne({
            where: { id: notification.actorId },
          });
          if (actor) {
            await this.emailService.sendFollowerNotificationEmail(
              user.email,
              actor.displayName,
            );
          }
        }
        break;

      case NotificationType.ITEM_RESERVED:
        if (notification.actorId && notification.data?.itemName) {
          const actor = await this.userRepository.findOne({
            where: { id: notification.actorId },
          });
          if (actor) {
            await this.emailService.sendItemReservedEmail(
              user.email,
              notification.data.itemName,
              actor.displayName,
            );
          }
        }
        break;

      default:
        // Generic notification email
        await this.emailService.sendNotificationEmail(
          user.email,
          notification.title,
          notification.body,
        );
    }
  }

  // Helper methods for creating specific notification types
  async createFollowerNotification(
    followedUserId: string,
    followerId: string,
  ): Promise<void> {
    const follower = await this.userRepository.findOne({
      where: { id: followerId },
    });

    if (!follower) return;

    await this.create({
      userId: followedUserId,
      type: NotificationType.NEW_FOLLOWER,
      title: 'New Follower',
      body: `${follower.displayName} started following you`,
      actorId: followerId,
    });
  }

  async createItemReservedNotification(
    itemOwnerId: string,
    reserverId: string,
    itemId: string,
    itemName: string,
  ): Promise<void> {
    const reserver = await this.userRepository.findOne({
      where: { id: reserverId },
    });

    if (!reserver) return;

    await this.create({
      userId: itemOwnerId,
      type: NotificationType.ITEM_RESERVED,
      title: 'Item Reserved',
      body: `${reserver.displayName} reserved your item: ${itemName}`,
      actorId: reserverId,
      itemId,
      data: { itemName },
    });
  }

  async createNewItemNotification(
    userId: string,
    creatorId: string,
    itemId: string,
    itemName: string,
  ): Promise<void> {
    const creator = await this.userRepository.findOne({
      where: { id: creatorId },
    });

    if (!creator) return;

    await this.create({
      userId,
      type: NotificationType.NEW_ITEM,
      title: 'New Wishlist Item',
      body: `${creator.displayName} added a new item: ${itemName}`,
      actorId: creatorId,
      itemId,
      data: { itemName },
    });
  }

  /**
   * Create price drop notification for followers
   * Only sends to users with push notifications enabled (have device tokens)
   */
  async createPriceDropNotifications(
    followerIds: string[],
    itemOwnerId: string,
    itemId: string,
    itemName: string,
    oldPrice: number,
    newPrice: number,
    currency: string,
  ): Promise<void> {
    const owner = await this.userRepository.findOne({
      where: { id: itemOwnerId },
    });

    if (!owner) return;

    // Get followers with device tokens (push enabled)
    const followersWithTokens = await this.deviceTokenRepository
      .createQueryBuilder('dt')
      .select('DISTINCT dt.userId', 'userId')
      .where('dt.userId IN (:...followerIds)', { followerIds })
      .getRawMany();

    const userIdsWithPush = followersWithTokens.map(f => f.userId);

    if (userIdsWithPush.length === 0) {
      this.logger.log('No followers with push notifications enabled');
      return;
    }

    // Calculate discount percentage
    const discountPercent = Math.round(((oldPrice - newPrice) / oldPrice) * 100);

    // Create notifications for each follower with push enabled
    const notifications = userIdsWithPush.map((userId) =>
      this.create({
        userId,
        type: NotificationType.PRICE_DROP,
        title: 'Price Drop Alert!',
        body: `${itemName} from ${owner.displayName}'s wishlist is now ${discountPercent}% cheaper! ${currency}${oldPrice} → ${currency}${newPrice}`,
        actorId: itemOwnerId,
        itemId,
        data: {
          itemName,
          oldPrice,
          newPrice,
          currency,
          discountPercent,
        },
      }),
    );

    await Promise.all(notifications);
    this.logger.log(`Sent price drop notifications to ${userIdsWithPush.length} followers`);
  }
}
