import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  User,
  WishlistItem,
  Follow,
  Notification,
  RefreshToken,
  DeviceToken,
} from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST'),
        port: config.get('DB_PORT'),
        username: config.get('DB_USERNAME'),
        password: config.get('DB_PASSWORD'),
        database: config.get('DB_DATABASE'),
        entities: [
          User,
          WishlistItem,
          Follow,
          Notification,
          RefreshToken,
          DeviceToken,
        ],
        synchronize: config.get('DB_SYNCHRONIZE') === 'true',
        logging: config.get('DB_LOGGING') === 'true',
        ssl: config.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
      }),
    }),
  ],
})
export class DatabaseModule {}
