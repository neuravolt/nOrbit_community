import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class StudentJwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    return true;
  }
}
