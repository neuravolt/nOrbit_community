import { IsArray, IsString } from 'class-validator';

export class AssignTaskDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];
}
