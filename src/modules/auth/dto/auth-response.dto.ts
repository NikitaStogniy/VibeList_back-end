import { ApiProperty } from '@nestjs/swagger';

class UserResponseDto {
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
}

export class AuthResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;

  @ApiProperty()
  token: string;

  @ApiProperty()
  refreshToken: string;
}
