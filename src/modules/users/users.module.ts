import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, Follow } from '@database/entities';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FollowService } from './follow.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Follow])],
  controllers: [UsersController],
  providers: [UsersService, FollowService],
  exports: [UsersService, FollowService],
})
export class UsersModule {}
