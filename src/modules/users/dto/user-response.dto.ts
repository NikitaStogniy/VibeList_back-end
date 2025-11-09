import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;

  @ApiProperty({ required: false })
  bio?: string;

  @ApiProperty()
  followersCount: number;

  @ApiProperty()
  followingCount: number;

  @ApiProperty()
  createdAt: Date;

  @Exclude()
  passwordHash: string;
}
