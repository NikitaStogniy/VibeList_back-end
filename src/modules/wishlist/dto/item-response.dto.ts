import { ApiProperty } from '@nestjs/swagger';
import { ItemPriority } from '@database/entities/wishlist-item.entity';

export class ItemResponseDto {
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

  @ApiProperty({ required: false })
  reservedBy?: string;

  @ApiProperty({ required: false })
  reservedAt?: Date;

  @ApiProperty({ enum: ItemPriority })
  priority: ItemPriority;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  isReserved: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
