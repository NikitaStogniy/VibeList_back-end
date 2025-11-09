import { IsNotEmpty, IsString, IsOptional, IsUUID, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@database/entities';

export class CreateNotificationDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

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
  data?: any;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUUID()
  itemId?: string;
}
