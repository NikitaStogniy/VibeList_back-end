import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { WishlistItem } from './wishlist-item.entity';
import { Follow } from './follow.entity';
import { Notification } from './notification.entity';
import { RefreshToken } from './refresh-token.entity';
import { DeviceToken } from './device-token.entity';

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['createdAt'])
@Index(['isActive'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, length: 255 })
  email: string;

  @Column({ unique: true, length: 50 })
  username: string;

  @Column({ name: 'password_hash', length: 255, nullable: true })
  @Exclude() // Exclude password from serialization
  passwordHash?: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName: string;

  @Column({ name: 'avatar_url', type: 'text', nullable: true })
  avatarUrl?: string;

  @Column({ type: 'text', nullable: true })
  bio?: string;

  @Column({ type: 'date', nullable: true })
  birthday?: Date;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'oauth_provider', length: 50, nullable: true })
  oauthProvider?: string;

  @Column({ name: 'oauth_provider_id', length: 255, nullable: true })
  @Index()
  oauthProviderId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => WishlistItem, (item) => item.user)
  wishlistItems: WishlistItem[];

  @OneToMany(() => Follow, (follow) => follow.follower)
  following: Follow[];

  @OneToMany(() => Follow, (follow) => follow.following)
  followers: Follow[];

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @OneToMany(() => RefreshToken, (token) => token.user)
  refreshTokens: RefreshToken[];

  @OneToMany(() => DeviceToken, (token) => token.user)
  deviceTokens: DeviceToken[];

  // Virtual fields (not stored in database)
  followersCount?: number;
  followingCount?: number;
}
