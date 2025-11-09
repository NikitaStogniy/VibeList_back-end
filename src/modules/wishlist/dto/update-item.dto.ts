import { IsString, IsOptional, IsNumber, IsUrl, IsEnum, IsBoolean, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ItemPriority } from '@database/entities/wishlist-item.entity';

export class UpdateItemDto {
  @ApiProperty({ required: false, example: 'Sony WH-1000XM5 Headphones' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({ required: false, example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ required: false, example: 349.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99999999.99)
  price?: number;

  @ApiProperty({ required: false, example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiProperty({ required: false, example: 'https://www.amazon.com/product/...' })
  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @ApiProperty({ required: false, example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiProperty({ required: false, enum: ItemPriority })
  @IsOptional()
  @IsEnum(ItemPriority)
  priority?: ItemPriority;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
