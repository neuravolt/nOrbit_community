import { Test, TestingModule } from '@nestjs/testing';
import { AdminPlansController } from '../admin-plans.controller';
import { AdminOrganizationsController } from '../admin-organizations.controller';
import { CustomerPlansController } from '../customer-plans.controller';
import { PlansService } from '../plans.service';
import { SubscriptionsService } from '../subscriptions.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

describe('Plans Controllers', () => {
  let adminPlansController: AdminPlansController;
  let adminOrgsController: AdminOrganizationsController;
  let customerPlansController: CustomerPlansController;

  let plansService: any;
  let subscriptionsService: any;

  beforeEach(async () => {
    plansService = {
      createPlan: jest.fn(),
      listAllPlans: jest.fn(),
      getPlanById: jest.fn(),
      updatePlan: jest.fn(),
      deactivatePlan: jest.fn(),
      getPublicPlans: jest.fn(),
    };

    subscriptionsService = {
      listOrganizationsWithSubscriptions: jest.fn(),
      getOrganizationSubscription: jest.fn(),
      updateSubscription: jest.fn(),
      initiateUpgrade: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AdminPlansController,
        AdminOrganizationsController,
        CustomerPlansController,
      ],
      providers: [
        { provide: PlansService, useValue: plansService },
        { provide: SubscriptionsService, useValue: subscriptionsService },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    adminPlansController =
      module.get<AdminPlansController>(AdminPlansController);
    adminOrgsController = module.get<AdminOrganizationsController>(
      AdminOrganizationsController,
    );
    customerPlansController = module.get<CustomerPlansController>(
      CustomerPlansController,
    );
  });

  describe('AdminPlansController', () => {
    it('creates a plan', async () => {
      plansService.createPlan.mockResolvedValue({ id: 'p1', name: 'Starter' });
      const res = await adminPlansController.createPlan({
        name: 'Starter',
        slug: 'starter',
      });
      expect(res).toEqual({ id: 'p1', name: 'Starter' });
      expect(plansService.createPlan).toHaveBeenCalled();
    });

    it('lists all plans', async () => {
      plansService.listAllPlans.mockResolvedValue([{ id: 'p1' }]);
      const res = await adminPlansController.listAllPlans('true');
      expect(res).toEqual([{ id: 'p1' }]);
      expect(plansService.listAllPlans).toHaveBeenCalledWith(true);
    });

    it('updates a plan', async () => {
      plansService.updatePlan.mockResolvedValue({ id: 'p1', name: 'Updated' });
      const res = await adminPlansController.updatePlan('p1', {
        name: 'Updated',
      });
      expect(res).toEqual({ id: 'p1', name: 'Updated' });
    });

    it('deactivates a plan', async () => {
      plansService.deactivatePlan.mockResolvedValue({
        id: 'p1',
        isActive: false,
      });
      const res = await adminPlansController.deactivatePlan('p1');
      expect(res).toEqual({ id: 'p1', isActive: false });
    });
  });

  describe('AdminOrganizationsController', () => {
    it('lists customer organizations with subscriptions', async () => {
      subscriptionsService.listOrganizationsWithSubscriptions.mockResolvedValue(
        [{ id: 'org-1' }],
      );
      const res = await adminOrgsController.listOrganizations('acme', 'p1');
      expect(res).toEqual([{ id: 'org-1' }]);
      expect(
        subscriptionsService.listOrganizationsWithSubscriptions,
      ).toHaveBeenCalledWith({
        search: 'acme',
        planId: 'p1',
      });
    });

    it('updates organization subscription overrides', async () => {
      subscriptionsService.updateSubscription.mockResolvedValue({
        id: 'sub-1',
        customMaxMembers: 25,
      });
      const res = await adminOrgsController.updateSubscription('org-1', {
        customMaxMembers: 25,
      });
      expect(res).toEqual({ id: 'sub-1', customMaxMembers: 25 });
    });
  });

  describe('CustomerPlansController', () => {
    it('returns public plans', async () => {
      plansService.getPublicPlans.mockResolvedValue([
        { id: 'p1', isPublic: true },
      ]);
      const res = await customerPlansController.getPublicPlans();
      expect(res).toEqual([{ id: 'p1', isPublic: true }]);
    });

    it('returns current subscription for active organization', async () => {
      subscriptionsService.getOrganizationSubscription.mockResolvedValue({
        subscription: { id: 'sub-1' },
      });
      const req = { user: { activeOrganizationId: 'org-1' } };
      const res = await customerPlansController.getCurrentSubscription(req);
      expect(res).toEqual({ subscription: { id: 'sub-1' } });
      expect(
        subscriptionsService.getOrganizationSubscription,
      ).toHaveBeenCalledWith('org-1');
    });

    it('initiates plan upgrade', async () => {
      subscriptionsService.initiateUpgrade.mockResolvedValue({
        invoiceId: 'inv-1',
        checkoutUrl: '/pay/inv-1',
      });
      const req = { user: { id: 'u1', activeOrganizationId: 'org-1' } };
      const res = await customerPlansController.upgradePlan(req, {
        planId: 'p2',
        billingInterval: 'MONTHLY',
      });
      expect(res).toEqual({ invoiceId: 'inv-1', checkoutUrl: '/pay/inv-1' });
      expect(subscriptionsService.initiateUpgrade).toHaveBeenCalledWith(
        'org-1',
        'u1',
        {
          planId: 'p2',
          billingInterval: 'MONTHLY',
        },
      );
    });
  });
});
