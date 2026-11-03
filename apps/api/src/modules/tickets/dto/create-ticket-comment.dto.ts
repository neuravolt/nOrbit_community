import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateTicketCommentDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}
