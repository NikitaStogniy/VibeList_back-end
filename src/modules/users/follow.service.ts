import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Follow, User } from '@database/entities';

@Injectable()
export class FollowService {
  constructor(
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private eventEmitter: EventEmitter2,
  ) {}

  async followUser(followerId: string, followingId: string): Promise<void> {
    // Cannot follow yourself
    if (followerId === followingId) {
      throw new BadRequestException('Cannot follow yourself');
    }

    // Check if target user exists
    const targetUser = await this.userRepository.findOne({ where: { id: followingId } });
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    // Check if already following
    const existingFollow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    if (existingFollow) {
      throw new BadRequestException('Already following this user');
    }

    // Create follow relationship
    const follow = this.followRepository.create({
      followerId,
      followingId,
    });

    await this.followRepository.save(follow);

    // Emit event for new follower
    this.eventEmitter.emit('user.followed', {
      followedUserId: followingId,
      followerId: followerId,
    });
  }

  async unfollowUser(followerId: string, followingId: string): Promise<void> {
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    if (!follow) {
      throw new BadRequestException('Not following this user');
    }

    await this.followRepository.remove(follow);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    const follow = await this.followRepository.findOne({
      where: { followerId, followingId },
    });

    return !!follow;
  }

  /**
   * Get all follower IDs for a user
   * Used for sending notifications to followers
   */
  async getFollowerIds(userId: string): Promise<string[]> {
    const follows = await this.followRepository.find({
      where: { followingId: userId },
      select: ['followerId'],
    });

    return follows.map(f => f.followerId);
  }
}
