import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { WishlistItem } from './wishlist-item.entity';

export enum NotificationType {
  NEW_FOLLOWER = 'new_follower',
  ITEM_RESERVED = 'item_reserved',
  ITEM_UNRESERVED = 'item_unreserved',
  NEW_ITEM = 'new_item',
  PRICE_DROP = 'price_drop',
  BIRTHDAY = 'birthday',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
@Index(['createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  type: NotificationType;

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  data?: any;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  @Column({ name: 'item_id', type: 'uuid', nullable: true })
  itemId?: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.notifications, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'actor_id' })
  actor?: User;

  @ManyToOne(() => WishlistItem, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: WishlistItem;
}
