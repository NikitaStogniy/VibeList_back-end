import { IsOptional, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export enum FeedSortBy {
  RECENT = 'recent',
  PRIORITY = 'priority',
}

export class GetFeedDto {
  @ApiProperty({ required: false, example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ required: false, example: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @ApiProperty({
    required: false,
    enum: FeedSortBy,
    default: FeedSortBy.RECENT
  })
  @IsOptional()
  @IsEnum(FeedSortBy)
  sortBy?: FeedSortBy = FeedSortBy.RECENT;
}
