import { IsString, IsNotEmpty, IsOptional, IsNumber, IsUrl, IsEnum, IsBoolean, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ItemPriority } from '@database/entities/wishlist-item.entity';

export class CreateItemDto {
  @ApiProperty({
    required: false,
    example: 'Sony WH-1000XM5 Headphones',
    description: 'Item name (required if productUrl not provided)'
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    required: false,
    example: 'Premium noise-canceling wireless headphones',
    description: 'Item description'
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, example: 399.99, description: 'Item price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  price?: number;

  @ApiProperty({ required: false, example: 'USD', description: 'Currency code' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({
    required: false,
    example: 'https://www.amazon.com/product/...',
    description: 'Product URL'
  })
  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @ApiProperty({
    required: false,
    example: 'https://example.com/image.jpg',
    description: 'Image URL'
  })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

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
