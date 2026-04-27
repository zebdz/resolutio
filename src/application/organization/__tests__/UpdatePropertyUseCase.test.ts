import { describe, it, expect } from 'vitest';
import { UpdatePropertyUseCase } from '../UpdatePropertyUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { OrganizationErrors } from '../OrganizationErrors';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

function mkProperty(): OrganizationProperty {
  return OrganizationProperty.reconstitute({
    id: 'p-1',
    organizationId: 'org-1',
    name: 'A',
    address: null,
    sizeUnit: 'SQUARE_METERS',
    createdAt: new Date(),
    archivedAt: null,
  });
}

describe('UpdatePropertyUseCase', () => {
  it('renames and updates sizeUnit', async () => {
    const p = mkProperty();
    const uc = new UpdatePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'admin',
      name: 'B',
      sizeUnit: 'UNIT_COUNT',
    });
    expect(r.success).toBe(true);
    expect(p.name).toBe('B');
    expect(p.sizeUnit).toBe('UNIT_COUNT');
  });

  it('rejects when property not found', async () => {
    const uc = new UpdatePropertyUseCase({
      propertyRepository: {
        findById: async () => success(null),
      } as any,
      organizationRepository: {} as any,
      userRepository: {} as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'missing',
      adminUserId: 'a',
      name: 'X',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }
  });

  it('rejects non-admin', async () => {
    const p = mkProperty();
    const uc = new UpdatePropertyUseCase({
      propertyRepository: {
        findById: async () => success(p),
        update: async () => success(undefined),
      } as any,
      organizationRepository: { isUserAdmin: async () => false } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      profanityChecker: { containsProfanity: () => false },
    });
    const r = await uc.execute({
      propertyId: 'p-1',
      adminUserId: 'non-admin',
      name: 'X',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationErrors.NOT_ADMIN);
    }
  });
});
