import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleAuthDto {
  @ApiProperty({
    description: 'Google ID token received from mobile client',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3...',
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
