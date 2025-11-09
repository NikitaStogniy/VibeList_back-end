import { ApiProperty } from '@nestjs/swagger';
import { ItemPriority } from '@database/entities';

export class FeedItemUserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;
}

export class WishlistItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  price?: number;

  @ApiProperty({ required: false })
  currency?: string;

  @ApiProperty({ required: false })
  productUrl?: string;

  @ApiProperty({ required: false })
  imageUrl?: string;

  @ApiProperty({ required: false, enum: ItemPriority })
  priority?: ItemPriority;

  @ApiProperty()
  isReserved: boolean;

  @ApiProperty({ required: false })
  reservedBy?: string;

  @ApiProperty({ required: false })
  reservedAt?: Date;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FeedItemResponseDto {
  @ApiProperty({ type: WishlistItemDto })
  wishlistItem: WishlistItemDto;

  @ApiProperty({ type: FeedItemUserDto })
  user: FeedItemUserDto;

  @ApiProperty()
  isFollowing: boolean;
}

export class FeedResponseDto {
  @ApiProperty({ type: [FeedItemResponseDto] })
  items: FeedItemResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  hasMore: boolean;
}
