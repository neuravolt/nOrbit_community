import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { redactSecrets } from '../audit/redact-secrets';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const url = request.url;

    // Skip GET requests and auth routes
    if (method === 'GET' || url.startsWith('/auth')) {
      return next.handle();
    }

    const userId = request.user?.id || null;
    const ip = request.ip || request.headers['x-forwarded-for'];
    const userAgent = request.headers['user-agent'];
    const body = request.body;

    // Attempt to extract resource type and ID from URL (e.g. /users/:id)
    const urlParts = url.split('/').filter(Boolean);
    const resourceType = urlParts[0] || 'Unknown';
    const resourceId =
      urlParts[1] && urlParts[1].length > 10 ? urlParts[1] : 'New/Bulk'; // Crude extraction

    let oldValues = null;

    // Try to fetch old values if it's PATCH or DELETE
    if (
      (method === 'PATCH' || method === 'DELETE') &&
      resourceId !== 'New/Bulk'
    ) {
      try {
        // If Prisma has a model matching the resource type, try to fetch it
        // E.g., 'users' -> 'user'
        const modelName = resourceType.endsWith('s')
          ? resourceType.slice(0, -1)
          : resourceType;
        if (this.prisma[modelName]) {
          oldValues = await this.prisma[modelName].findUnique({
            where: { id: resourceId },
          });
        }
      } catch (e) {
        // Ignore failure, we just won't have oldValues
      }
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const actionMap: Record<string, string> = {
            POST: 'CREATE',
            PATCH: 'UPDATE',
            DELETE: 'DELETE',
          };

          let actualResourceId = resourceId;
          // If creation, response usually contains the ID
          if (method === 'POST' && response && response.id) {
            actualResourceId = response.id;
          }

          const action = actionMap[method] || method;

          await this.prisma.auditLog.create({
            data: {
              userId,
              action,
              resourceType,
              resourceId: String(actualResourceId || resourceId || 'N/A'),
              // Bodies of login/register/user-create routes carry plaintext passwords and the
              // pre-image of a PATCH /users/:id carries passwordHash — never persist those.
              metadata: JSON.parse(
                JSON.stringify(
                  redactSecrets({
                    ip,
                    userAgent,
                    oldValues,
                    newValues:
                      method === 'DELETE'
                        ? null
                        : method === 'POST'
                          ? body
                          : response,
                  }),
                ),
              ),
            },
          });
        } catch (error) {
          console.error('Failed to log audit:', error);
        }
      }),
    );
  }
}
