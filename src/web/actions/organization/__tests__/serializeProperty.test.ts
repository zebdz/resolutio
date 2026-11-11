/** Property and asset responses preserve exact values and archive timestamps.
 * Explicit projections keep aggregate state and unrelated fields off the client. */
import { describe, expect, it } from 'vitest';
import { OrganizationProperty } from '@/domain/organization/OrganizationProperty';
import { PropertyAsset } from '@/domain/organization/PropertyAsset';
import { serializeAsset, serializeProperty } from '../serializeProperty';

const createdAt = new Date('2026-11-04T00:00:00.000Z');
const archivedAt = '2026-11-04T12:34:56.789Z';

describe('property and asset response serialization', () => {
  it.each([
    { archivedAt: null, address: null },
    { archivedAt, address: '1 Main Street' },
  ])('serializes a property with archive time $archivedAt', (state) => {
    const property = OrganizationProperty.reconstitute({
      id: 'property-1',
      organizationId: 'organization-1',
      name: 'Building',
      address: state.address,
      sizeUnit: 'SQUARE_METERS',
      createdAt,
      archivedAt: state.archivedAt === null ? null : new Date(state.archivedAt),
    });
    Object.assign(property, { privateAuditNote: 'server-only' });
    const view = serializeProperty(property);

    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(view))).toEqual({
      id: 'property-1',
      name: 'Building',
      address: state.address,
      sizeUnit: 'SQUARE_METERS',
      archivedAt: state.archivedAt,
    });
  });

  it.each([null, archivedAt])(
    'serializes an asset with archive time %s',
    (at) => {
      const asset = PropertyAsset.reconstitute({
        id: 'asset-1',
        propertyId: 'property-1',
        name: 'Unit',
        size: 123.456789123,
        createdAt,
        archivedAt: at === null ? null : new Date(at),
      });
      Object.assign(asset, { privateAuditNote: 'server-only' });
      const view = serializeAsset(asset);

      expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
      expect(JSON.parse(JSON.stringify(view))).toEqual({
        id: 'asset-1',
        name: 'Unit',
        size: 123.456789123,
        archivedAt: at,
      });
    }
  );
});
