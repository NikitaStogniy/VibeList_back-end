import { IsString, IsNotEmpty, IsUrl, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ItemPriority } from '@database/entities/wishlist-item.entity';

export class CreateItemFromUrlDto {
  @ApiProperty({
    example: 'https://www.amazon.com/product/...',
    description: 'Product URL to parse'
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;

  @ApiProperty({
    required: false,
    enum: ItemPriority,
    default: ItemPriority.MEDIUM,
    description: 'Item priority'
  })
  @IsOptional()
  @IsEnum(ItemPriority)
  priority?: ItemPriority;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Whether item is visible to others'
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
