import { IsString } from 'class-validator';

export class AssignTicketDto {
  @IsString()
  assignedToId: string;
}
