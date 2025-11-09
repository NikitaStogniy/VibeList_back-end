import { IsOptional, IsEnum, IsInt, Min, Max, IsString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ItemPriority } from '@database/entities/wishlist-item.entity';

export class FilterItemsDto {
  @ApiProperty({ required: false, enum: ItemPriority, description: 'Filter by priority' })
  @IsOptional()
  @IsEnum(ItemPriority)
  priority?: ItemPriority;

  @ApiProperty({ required: false, description: 'Filter by reservation status' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isReserved?: boolean;

  @ApiProperty({ required: false, description: 'Search query for item name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({ required: false, example: 20, default: 20, description: 'Items per page' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, example: 0, default: 0, description: 'Pagination offset' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
