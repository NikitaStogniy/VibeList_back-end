import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  AfterLoad,
  Index,
} from 'typeorm';
import { User } from './user.entity';

export enum ItemPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('wishlist_items')
@Index(['userId', 'createdAt'])
@Index(['userId', 'isPublic'])
@Index(['reservedBy'])
@Index(['createdAt'])
export class WishlistItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ length: 255, nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  price?: number;

  @Column({ length: 3, default: 'USD', nullable: true })
  currency?: string;

  @Column({ name: 'product_url', type: 'text', nullable: true })
  productUrl?: string;

  @Column({ name: 'image_url', type: 'text', nullable: true })
  imageUrl?: string;

  @Column({ length: 100, nullable: true })
  category?: string;

  @Column({ name: 'reserved_by_user_id', type: 'uuid', nullable: true })
  reservedBy?: string;

  @Column({ name: 'reserved_at', type: 'timestamp', nullable: true })
  reservedAt?: Date;

  @Column({
    type: 'varchar',
    length: 10,
    default: ItemPriority.MEDIUM,
    nullable: true,
  })
  priority?: ItemPriority;

  @Column({ name: 'is_public', default: true })
  isPublic: boolean;

  @Column({ name: 'last_parsed_at', type: 'timestamp', nullable: true })
  lastParsedAt?: Date;

  @Column({ name: 'parsing_enabled', default: true })
  @Index()
  parsingEnabled: boolean;

  @Column({ name: 'parsing_failed_count', default: 0 })
  parsingFailedCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.wishlistItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reserved_by_user_id' })
  reservedByUser?: User;

  // Virtual field (will be set by @AfterLoad)
  isReserved: boolean;

  @AfterLoad()
  setIsReserved() {
    this.isReserved = !!this.reservedBy;
  }
}
