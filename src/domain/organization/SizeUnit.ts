import { Result, success, failure } from '../shared/Result';
import { OrganizationDomainCodes } from './OrganizationDomainCodes';

export type SizeUnitValue =
  | 'SQUARE_METERS'
  | 'SQUARE_FEET'
  | 'HECTARES'
  | 'ACRES'
  | 'CUBIC_METERS'
  | 'LINEAR_METERS'
  | 'UNIT_COUNT'
  | 'SHARES';

const VALUES: SizeUnitValue[] = [
  'SQUARE_METERS',
  'SQUARE_FEET',
  'HECTARES',
  'ACRES',
  'CUBIC_METERS',
  'LINEAR_METERS',
  'UNIT_COUNT',
  'SHARES',
];

function toCamel(v: SizeUnitValue): string {
  const [head, ...rest] = v.toLowerCase().split('_');

  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}

export const SizeUnit = {
  values: VALUES,

  parse(value: string): Result<SizeUnitValue, string> {
    if (VALUES.includes(value as SizeUnitValue)) {
      return success(value as SizeUnitValue);
    }

    return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
  },

  translationKey(value: SizeUnitValue): string {
    return `propertyAdmin.sizeUnit.${toCamel(value)}`;
  },
};
