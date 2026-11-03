import { IsString, IsOptional } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsString()
  type: string;

  @IsOptional()
  @IsString()
  link?: string;
}

export class ListNotificationsQuery {
  read?: boolean | string;
}
