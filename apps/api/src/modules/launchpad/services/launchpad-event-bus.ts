import { Injectable } from '@nestjs/common';

@Injectable()
export class LaunchpadEventBus {
  emit(_event: string, ..._args: any[]) {}
}
