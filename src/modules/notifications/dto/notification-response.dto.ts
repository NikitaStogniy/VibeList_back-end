import { ApiProperty } from '@nestjs/swagger';
import { NotificationType } from '@database/entities';

export class NotificationActorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty({ required: false })
  avatarUrl?: string;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  body: string;

  @ApiProperty({ required: false })
  data?: any;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false, type: NotificationActorDto })
  actor?: NotificationActorDto;
}
