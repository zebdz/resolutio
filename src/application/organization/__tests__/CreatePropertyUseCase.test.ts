import { describe, it, expect } from 'vitest';
import { CreatePropertyUseCase } from '../CreatePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success, failure } from '../../../domain/shared/Result';

const mkDeps = (
  overrides: Partial<{
    isAdmin: boolean;
    isSuperAdmin: boolean;
    save: 'ok' | 'err';
  }> = {}
) => {
  const cfg = {
    isAdmin: true,
    isSuperAdmin: false,
    save: 'ok' as 'ok' | 'err',
    ...overrides,
  };
  const saved: OrganizationProperty[] = [];
  const deps = {
    propertyRepository: {
      save: async (p: OrganizationProperty) => {
        saved.push(p);

        return cfg.save === 'ok' ? success(p) : failure('db');
      },
    } as any,
    organizationRepository: {
      isUserAdmin: async () => cfg.isAdmin,
    } as any,
    userRepository: {
      isSuperAdmin: async () => cfg.isSuperAdmin,
    } as any,
    profanityChecker: { containsProfanity: () => false },
  };

  return { deps, saved };
};

describe('CreatePropertyUseCase', () => {
  it('creates a property when user is org admin', async () => {
    const { deps, saved } = mkDeps();
    const uc = new CreatePropertyUseCase(deps);
    const r = await uc.execute({
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      name: 'Building A',
      address: null,
      sizeUnit: 'SQUARE_METERS',
    });
    expect(r.success).toBe(true);
    expect(saved.length).toBe(1);
  });

  it('rejects non-admin, non-superadmin', async () => {
    const { deps } = mkDeps({ isAdmin: false, isSuperAdmin: false });
    const uc = new CreatePropertyUseCase(deps);
    const r = await uc.execute({
      organizationId: 'org-1',
      adminUserId: 'u',
      name: 'B',
      address: null,
      sizeUnit: 'SQUARE_METERS',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });

  it('rejects invalid size unit', async () => {
    const { deps } = mkDeps();
    const uc = new CreatePropertyUseCase(deps);
    const r = await uc.execute({
      organizationId: 'org-1',
      adminUserId: 'admin-1',
      name: 'B',
      address: null,
      sizeUnit: 'FURLONGS',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.SIZE_UNIT_INVALID);
    }
  });
});
