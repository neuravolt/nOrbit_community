import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const Permissions = createParamDecorator(
  (permissions: string | string[], ctx: ExecutionContext): string[] => {
    if (typeof permissions === 'string') {
      return [permissions];
    }
    return permissions || [];
  },
);
