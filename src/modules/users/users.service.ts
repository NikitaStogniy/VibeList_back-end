import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { User, Follow } from '@database/entities';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  // OWASP recommends 12 rounds as of 2024 for good security/performance balance
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Follow)
    private followRepository: Repository<Follow>,
  ) {}

  async create(userData: {
    email: string;
    username: string;
    password: string;
    displayName: string;
  }): Promise<User> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: userData.email }, { username: userData.username }],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new ConflictException('Email already exists');
      }
      throw new ConflictException('Username already exists');
    }

    // Hash password with secure bcrypt rounds
    const passwordHash = await bcrypt.hash(userData.password, this.BCRYPT_ROUNDS);

    // Create user
    const user = this.usersRepository.create({
      email: userData.email,
      username: userData.username,
      passwordHash,
      displayName: userData.displayName,
    });

    return await this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string): Promise<User | null> {
    return await this.usersRepository.findOne({ where: { username } });
  }

  async validatePassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) {
      return false; // OAuth users don't have passwords
    }
    return await bcrypt.compare(password, user.passwordHash);
  }

  async createOAuthUser(userData: {
    email: string;
    username: string;
    displayName: string;
    provider: string;
    providerId: string;
    avatarUrl?: string;
    emailVerified?: boolean;
  }): Promise<User> {
    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ email: userData.email }, { username: userData.username }],
    });

    if (existingUser) {
      if (existingUser.email === userData.email) {
        throw new ConflictException('Email already exists');
      }
      throw new ConflictException('Username already exists');
    }

    // Create OAuth user without password
    const user = this.usersRepository.create({
      email: userData.email,
      username: userData.username,
      displayName: userData.displayName,
      avatarUrl: userData.avatarUrl,
      emailVerified: userData.emailVerified || false,
      oauthProvider: userData.provider,
      oauthProviderId: userData.providerId,
    });

    return await this.usersRepository.save(user);
  }

  async updateOAuthInfo(userId: string, provider: string, providerId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      oauthProvider: provider,
      oauthProviderId: providerId,
    });
  }

  async updateEmailVerified(userId: string): Promise<void> {
    await this.usersRepository.update(userId, { emailVerified: true });
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, this.BCRYPT_ROUNDS);
    await this.usersRepository.update(userId, { passwordHash });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get counts
    user.followersCount = await this.getFollowersCount(id);
    user.followingCount = await this.getFollowingCount(id);

    return user;
  }

  async findByUsernameWithCounts(username: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { username } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.followersCount = await this.getFollowersCount(user.id);
    user.followingCount = await this.getFollowingCount(user.id);

    return user;
  }

  async updateProfile(userId: string, updateDto: UpdateProfileDto): Promise<User> {
    const user = await this.findById(userId);

    Object.assign(user, updateDto);

    return await this.usersRepository.save(user);
  }

  async searchUsers(searchDto: SearchUsersDto) {
    const { query, limit = 20, offset = 0 } = searchDto;

    const [users, total] = await this.usersRepository.findAndCount({
      where: [
        { username: ILike(`%${query}%`) },
        { displayName: ILike(`%${query}%`) },
      ],
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    // Enhance users with counts - fix N+1 query by batching
    const enhancedUsers = await this.enrichUsersWithCounts(users);

    return {
      users: enhancedUsers,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getFollowersCount(userId: string): Promise<number> {
    return await this.followRepository.count({
      where: { followingId: userId },
    });
  }

  async getFollowingCount(userId: string): Promise<number> {
    return await this.followRepository.count({
      where: { followerId: userId },
    });
  }

  async getFollowers(userId: string, limit: number = 20, offset: number = 0) {
    const [follows, total] = await this.followRepository.findAndCount({
      where: { followingId: userId },
      relations: ['follower'],
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    const users = follows.map((follow) => follow.follower);

    // Enhance with counts - fix N+1 query by batching
    const enhancedUsers = await this.enrichUsersWithCounts(users);

    return {
      users: enhancedUsers,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getFollowing(userId: string, limit: number = 20, offset: number = 0) {
    const [follows, total] = await this.followRepository.findAndCount({
      where: { followerId: userId },
      relations: ['following'],
      take: limit,
      skip: offset,
      order: { createdAt: 'DESC' },
    });

    const users = follows.map((follow) => follow.following);

    // Enhance with counts - fix N+1 query by batching
    const enhancedUsers = await this.enrichUsersWithCounts(users);

    return {
      users: enhancedUsers,
      total,
      hasMore: offset + limit < total,
    };
  }

  /**
   * Efficiently enrich users with follower/following counts
   * Fixes N+1 query problem by batching all counts in 2 queries instead of 2N queries
   */
  private async enrichUsersWithCounts(users: User[]): Promise<User[]> {
    if (users.length === 0) {
      return users;
    }

    const userIds = users.map((user) => user.id);

    // Fetch all followers counts in a single query
    const followersData = await this.followRepository
      .createQueryBuilder('follow')
      .select('follow.followingId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('follow.followingId IN (:...userIds)', { userIds })
      .groupBy('follow.followingId')
      .getRawMany();

    // Fetch all following counts in a single query
    const followingData = await this.followRepository
      .createQueryBuilder('follow')
      .select('follow.followerId', 'userId')
      .addSelect('COUNT(*)', 'count')
      .where('follow.followerId IN (:...userIds)', { userIds })
      .groupBy('follow.followerId')
      .getRawMany();

    // Create maps for O(1) lookup
    const followersMap = new Map<string, number>();
    const followingMap = new Map<string, number>();

    followersData.forEach((row) => {
      followersMap.set(row.userId, parseInt(row.count, 10));
    });

    followingData.forEach((row) => {
      followingMap.set(row.userId, parseInt(row.count, 10));
    });

    // Enrich users with counts
    return users.map((user) => {
      user.followersCount = followersMap.get(user.id) || 0;
      user.followingCount = followingMap.get(user.id) || 0;
      return user;
    });
  }
}
