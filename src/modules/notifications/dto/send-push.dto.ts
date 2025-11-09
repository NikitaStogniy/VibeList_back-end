import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendPushDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  data?: Record<string, string>;
}
