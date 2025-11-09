import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WishlistItem, Follow, User } from '@database/entities';
import { FeedController } from './feed.controller';
import { FeedService } from './services/feed.service';
import { FeedCacheService } from './services/feed-cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WishlistItem, Follow, User]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL', 'redis://localhost:6379');

        return {
          store: await redisStore({
            url: redisUrl,
          }),
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [FeedController],
  providers: [FeedService, FeedCacheService],
  exports: [FeedService],
})
export class FeedModule {}
