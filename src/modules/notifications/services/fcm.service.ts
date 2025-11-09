import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FCMService implements OnModuleInit {
  private readonly logger = new Logger(FCMService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.configService.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');

    if (!serviceAccount) {
      this.logger.warn('Firebase service account not configured. Push notifications will be disabled.');
      return;
    }

    try {
      admin.initializeApp({
        credential: admin.credential.cert(require(serviceAccount)),
      });
      this.logger.log('Firebase Admin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin', error);
    }
  }

  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token,
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Successfully sent message: ${response}`);
      return true;
    } catch (error) {
      this.logger.error(`Error sending message to token ${token}:`, error);
      return false;
    }
  }

  async sendToMultipleDevices(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens,
      };

      const response = await admin.messaging().sendMulticast(message);

      this.logger.log(`Successfully sent ${response.successCount} messages`);

      if (response.failureCount > 0) {
        this.logger.warn(`Failed to send ${response.failureCount} messages`);
      }

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error('Error sending messages:', error);
      return { successCount: 0, failureCount: tokens.length };
    }
  }
}
