import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { Notification, User, DeviceToken, Follow } from '@database/entities';
import { NotificationsController } from './notifications.controller';
import { DeviceTokensController } from './device-tokens.controller';
import { NotificationsService } from './services/notifications.service';
import { FCMService } from './services/fcm.service';
import { EmailService } from './services/email.service';
import { DeviceTokensService } from './services/device-tokens.service';
import { BirthdayNotificationService } from './services/birthday-notification.service';
import { NotificationListener } from './listeners/notification.listener';
import { ResendProvider } from './providers/resend.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, User, DeviceToken, Follow]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
  ],
  controllers: [NotificationsController, DeviceTokensController],
  providers: [
    ResendProvider,
    NotificationsService,
    FCMService,
    EmailService,
    DeviceTokensService,
    BirthdayNotificationService,
    NotificationListener,
  ],
  exports: [NotificationsService, DeviceTokensService, BirthdayNotificationService],
})
export class NotificationsModule {}
