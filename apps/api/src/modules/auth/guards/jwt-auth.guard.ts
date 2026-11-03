import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const CUSTOMER_ALLOWED_CONTROLLERS = new Set([
  'ProjectsController',
  'TasksController',
  'ClientsController',
  'BillingController',
  'TicketsController',
  'OrganizationsController',
  'UploadsController',
  'AuthController',
  'CustomerPlansController',
  'SalesController',
  'LeadsController',
  'AmcController',
  'CompanyProfileController',
  'ChatController',
  'MeetingsController',
  'MailboxController',
  'ManualPaymentsController',
  'PaymentsController',
  'ReportsController',
  'HrController',
  'HrmsController',
]);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  override handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ) {
    const reqUser = super.handleRequest(err, user, info, context);
    if (!reqUser) return reqUser;

    if (reqUser.userType === 'CUSTOMER') {
      const controller = context.getClass();
      const controllerName = controller ? controller.name : '';
      if (controllerName && !CUSTOMER_ALLOWED_CONTROLLERS.has(controllerName)) {
        throw new ForbiddenException(
          'Access denied: customers cannot access internal staff resources',
        );
      }
    }
    return reqUser;
  }
}
