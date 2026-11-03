import { IsString } from 'class-validator';

export class UpdateTaskStatusDto {
  @IsString()
  status: string; // todo, in_progress, review, done
}
