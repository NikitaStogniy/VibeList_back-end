import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiProperty({ required: false, example: 'John Doe Updated' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @ApiProperty({ required: false, example: 'Software engineer and tech enthusiast' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiProperty({ required: false, example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
