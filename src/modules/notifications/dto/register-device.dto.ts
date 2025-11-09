import { IsNotEmpty, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@database/entities';

export class RegisterDeviceDto {
  @ApiProperty({ example: 'fcm-token-here' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ enum: Platform, example: Platform.IOS })
  @IsEnum(Platform)
  platform: Platform;
}
