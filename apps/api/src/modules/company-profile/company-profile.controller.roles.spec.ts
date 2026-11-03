import { Reflector } from '@nestjs/core';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CompanyProfileController } from './company-profile.controller';
import { Roles, RolesGuard } from '../users/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('CompanyProfileController write routes are role-restricted', () => {
  const reflector = new Reflector();
  const proto = CompanyProfileController.prototype as any;

  it.each([
    'upsert',
    'uploadLogo',
    'uploadFavicon',
    'uploadSignature',
    'uploadStamp',
  ])('%s requires JWT + SUPER_ADMIN/MANAGER', (method) => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, proto[method]);
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(reflector.get(Roles, proto[method])).toEqual([
      'SUPER_ADMIN',
      'MANAGER',
    ]);
  });

  it('read route stays open to any authenticated staff user', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, proto.get)).toEqual([
      JwtAuthGuard,
    ]);
    expect(reflector.get(Roles, proto.get)).toBeUndefined();
  });
});
