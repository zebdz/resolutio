import { describe, it, expect } from 'vitest';
import { ListOrgPropertiesForMemberUseCase } from '../ListOrgPropertiesForMemberUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const mkProp = (id: string, name: string, addr: string | null) =>
  OrganizationProperty.reconstitute({
    id,
    organizationId: 'org-1',
    name,
    address: addr,
    sizeUnit: 'SQUARE_METERS',
    createdAt: new Date(),
    archivedAt: null,
  });

describe('ListOrgPropertiesForMemberUseCase', () => {
  it('returns only {id, name, address} for members', async () => {
    const uc = new ListOrgPropertiesForMemberUseCase({
      propertyRepository: {
        findByOrganization: async () =>
          success([
            mkProp('p-1', 'Bldg A', '1 St'),
            mkProp('p-2', 'Bldg B', null),
          ]),
      } as any,
      organizationRepository: {
        isUserMember: async () => true,
        isUserAdmin: async () => false,
      } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ userId: 'u', organizationId: 'org-1' });
    expect(r.success).toBe(true);

    if (r.success) {
      expect(r.value).toEqual([
        { id: 'p-1', name: 'Bldg A', address: '1 St' },
        { id: 'p-2', name: 'Bldg B', address: null },
      ]);

      // Projection check — no other keys:
      for (const p of r.value) {
        expect(Object.keys(p).sort()).toEqual(['address', 'id', 'name']);
      }
    }
  });

  it('allows admins and superadmins even if not member', async () => {
    const uc = new ListOrgPropertiesForMemberUseCase({
      propertyRepository: {
        findByOrganization: async () => success([mkProp('p-1', 'X', null)]),
      } as any,
      organizationRepository: {
        isUserMember: async () => false,
        isUserAdmin: async () => true,
      } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ userId: 'admin', organizationId: 'org-1' });
    expect(r.success).toBe(true);
  });

  it('rejects non-member caller with NOT_ORG_MEMBER', async () => {
    const uc = new ListOrgPropertiesForMemberUseCase({
      propertyRepository: {
        findByOrganization: async () => success([mkProp('p-1', 'X', null)]),
      } as any,
      organizationRepository: {
        isUserMember: async () => false,
        isUserAdmin: async () => false,
      } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
    });
    const r = await uc.execute({ userId: 'rand', organizationId: 'org-1' });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }
  });
});
