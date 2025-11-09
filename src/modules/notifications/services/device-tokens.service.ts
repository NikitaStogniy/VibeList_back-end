import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceToken, Platform } from '@database/entities';

@Injectable()
export class DeviceTokensService {
  private readonly logger = new Logger(DeviceTokensService.name);

  constructor(
    @InjectRepository(DeviceToken)
    private deviceTokenRepository: Repository<DeviceToken>,
  ) {}

  async register(
    userId: string,
    token: string,
    platform: Platform,
  ): Promise<DeviceToken> {
    // Check if token already exists for this user
    const existing = await this.deviceTokenRepository.findOne({
      where: { userId, token },
    });

    if (existing) {
      // Update timestamp
      existing.updatedAt = new Date();
      return await this.deviceTokenRepository.save(existing);
    }

    // Create new device token
    const deviceToken = this.deviceTokenRepository.create({
      userId,
      token,
      platform,
    });

    return await this.deviceTokenRepository.save(deviceToken);
  }

  async unregister(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ userId, token });
  }

  async getUserTokens(userId: string): Promise<DeviceToken[]> {
    return await this.deviceTokenRepository.find({ where: { userId } });
  }

  async removeInvalidToken(token: string): Promise<void> {
    await this.deviceTokenRepository.delete({ token });
  }
}
