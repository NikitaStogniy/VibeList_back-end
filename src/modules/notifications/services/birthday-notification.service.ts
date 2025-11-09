import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { User, Notification, NotificationType } from '@database/entities';
import { FCMService } from './fcm.service';
import { DeviceTokensService } from './device-tokens.service';

@Injectable()
export class BirthdayNotificationService {
  private readonly logger = new Logger(BirthdayNotificationService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private fcmService: FCMService,
    private deviceTokensService: DeviceTokensService,
  ) {}

  /**
   * Cron job that runs every day at 9:00 AM
   * Finds users with birthday today and sends notifications to their followers
   */
  @Cron('0 9 * * *', {
    name: 'birthday-notifications',
    timeZone: 'UTC', // TODO: Configure timezone from environment
  })
  async handleBirthdayNotifications() {
    this.logger.log('Running birthday notifications cron job');

    try {
      // Get today's date (month and day only)
      const today = new Date();
      const todayMonth = today.getMonth() + 1; // getMonth() returns 0-11
      const todayDay = today.getDate();

      this.logger.log(`Checking for birthdays on ${todayMonth}/${todayDay}`);

      // Find all users with birthday today
      const usersWithBirthday = await this.userRepository
        .createQueryBuilder('user')
        .where('user.birthday IS NOT NULL')
        .andWhere('EXTRACT(MONTH FROM user.birthday) = :month', { month: todayMonth })
        .andWhere('EXTRACT(DAY FROM user.birthday) = :day', { day: todayDay })
        .andWhere('user.isActive = :isActive', { isActive: true })
        .leftJoinAndSelect('user.followers', 'followers')
        .leftJoinAndSelect('followers.follower', 'followerUser')
        .getMany();

      this.logger.log(`Found ${usersWithBirthday.length} users with birthday today`);

      // Process each user with birthday
      for (const birthdayUser of usersWithBirthday) {
        await this.sendBirthdayNotifications(birthdayUser);
      }

      this.logger.log('Birthday notifications cron job completed');
    } catch (error) {
      this.logger.error('Error in birthday notifications cron job:', error);
    }
  }

  /**
   * Send birthday notifications to all followers of a user
   */
  private async sendBirthdayNotifications(birthdayUser: User) {
    this.logger.log(`Sending birthday notifications for user: ${birthdayUser.username}`);

    if (!birthdayUser.followers || birthdayUser.followers.length === 0) {
      this.logger.log(`User ${birthdayUser.username} has no followers`);
      return;
    }

    const title = `🎉 Birthday Today!`;
    const body = `Today is ${birthdayUser.displayName || birthdayUser.username}'s birthday! Send them your wishes!`;

    // Send notification to each follower
    for (const follow of birthdayUser.followers) {
      const followerId = follow.follower.id;

      try {
        // Create notification in database
        const notification = this.notificationRepository.create({
          userId: followerId,
          type: NotificationType.BIRTHDAY,
          title,
          body,
          actorId: birthdayUser.id,
          data: {
            birthdayUserId: birthdayUser.id,
            birthdayUsername: birthdayUser.username,
            screen: `/profile/${birthdayUser.id}`,
          },
        });

        await this.notificationRepository.save(notification);

        // Get follower's device tokens
        const deviceTokens = await this.deviceTokensService.getUserTokens(followerId);

        if (deviceTokens.length === 0) {
          this.logger.log(`Follower ${followerId} has no device tokens`);
          continue;
        }

        // Send push notification to all devices
        const tokens = deviceTokens.map((dt) => dt.token);

        await this.fcmService.sendToMultipleDevices(
          tokens,
          title,
          body,
          {
            type: NotificationType.BIRTHDAY,
            birthdayUserId: birthdayUser.id,
            birthdayUsername: birthdayUser.username,
            screen: `/profile/${birthdayUser.id}`,
          },
        );

        this.logger.log(`Birthday notification sent to follower ${followerId}`);
      } catch (error) {
        this.logger.error(`Error sending birthday notification to follower ${followerId}:`, error);
        // Continue with next follower even if this one fails
      }
    }

    this.logger.log(`Sent ${birthdayUser.followers.length} birthday notifications for ${birthdayUser.username}`);
  }

  /**
   * Manual trigger for testing purposes
   * Can be called from a controller endpoint
   */
  async triggerBirthdayNotifications() {
    this.logger.log('Manually triggering birthday notifications');
    await this.handleBirthdayNotifications();
  }
}
