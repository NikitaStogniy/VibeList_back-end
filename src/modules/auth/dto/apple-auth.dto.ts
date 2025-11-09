import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppleAuthDto {
  @ApiProperty({
    description: 'Apple identity token received from mobile client',
    example: 'eyJraWQiOiJlWGF1bm1MIiwiYWxnIjoiUlMyNTYifQ...',
  })
  @IsString()
  @IsNotEmpty()
  identityToken: string;

  @ApiPropertyOptional({
    description: 'User information (only provided on first sign-in)',
    example: JSON.stringify({ firstName: 'John', lastName: 'Doe' }),
  })
  @IsString()
  @IsOptional()
  user?: string;
}
