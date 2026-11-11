/** Property adapter contracts preserve domain creation data and reject corrupt
 * persisted records without exposing storage/validation details to callers. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaOrganizationPropertyRepository } from '../PrismaOrganizationPropertyRepository';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyId, OrganizationId } from '../../../domain/shared/EntityIds';
const row = {
  id: 'property-created',
  organizationId: 'org-1',
  name: 'Building',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  archivedAt: null,
};
describe('PrismaOrganizationPropertyRepository', () => {
  it('preserves caller identity and time through a save/read boundary', async () => {
    const create = vi.fn(async ({ data }: any) => ({
      ...row,
      id: 'db-default',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      ...data,
    }));
    const result = await new PrismaOrganizationPropertyRepository({
      organizationProperty: { create },
    } as any).save(OrganizationProperty.reconstitute(row));
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.id).toBe(row.id);
      expect(result.value.createdAt).toEqual(row.createdAt);
    }
  });
  it('normalizes invalid persisted units to a stable failure', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ ...row, sizeUnit: 'UNKNOWN' });
    expect(
      await new PrismaOrganizationPropertyRepository({
        organizationProperty: { findUnique },
      } as any).findById(PropertyId.parse(row.id))
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  });
  it('rejects an invalid organization label in a property-tree projection', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'org-1', name: '' }]);
    const repository = new PrismaOrganizationPropertyRepository({
      organization: { findMany },
      organizationProperty: { findMany: vi.fn().mockResolvedValue([]) },
    } as any);
    expect(
      await repository.findByOrganizationTree(OrganizationId.parse('org-1'))
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  });
});
