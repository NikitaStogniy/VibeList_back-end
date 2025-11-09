import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { WishlistItem, User, Follow } from '@database/entities';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './services/wishlist.service';
import { ReservationService } from './services/reservation.service';
import { ParserGatewayService } from './services/parser-gateway.service';
import { PriceMonitorService } from './services/price-monitor.service';
import { NightlyPriceCheckTask } from './tasks/nightly-price-check.task';
import { ParserProcessor } from './processors/parser.processor';
import { PARSER_QUEUE } from '../../config/queue.config';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ParserModule } from '../parser/parser.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WishlistItem, User, Follow]),
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 5,
    }),
    BullModule.registerQueue(
      { name: PARSER_QUEUE },
    ),
    ParserModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [WishlistController],
  providers: [
    WishlistService,
    ReservationService,
    ParserGatewayService,
    PriceMonitorService,
    NightlyPriceCheckTask,
    ParserProcessor,
  ],
  exports: [WishlistService, ReservationService, ParserGatewayService, PriceMonitorService],
})
export class WishlistModule {}
