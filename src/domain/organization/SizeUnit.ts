/** Closed size-unit vocabulary shared by property validation and selectors.
 * Public choices are immutable so reading them cannot redefine valid units. */
import { Result, success, failure } from '../shared/Result';
import {
  OrganizationDomainCode,
  OrganizationDomainCodes,
} from './OrganizationDomainCodes';

export type SizeUnitValue =
  | 'SQUARE_METERS'
  | 'SQUARE_FEET'
  | 'HECTARES'
  | 'ACRES'
  | 'CUBIC_METERS'
  | 'LINEAR_METERS'
  | 'UNIT_COUNT'
  | 'SHARES';

const VALUES: readonly SizeUnitValue[] = Object.freeze([
  'SQUARE_METERS',
  'SQUARE_FEET',
  'HECTARES',
  'ACRES',
  'CUBIC_METERS',
  'LINEAR_METERS',
  'UNIT_COUNT',
  'SHARES',
]);

const TRANSLATION_KEYS = {
  SQUARE_METERS: 'propertyAdmin.sizeUnit.squareMeters',
  SQUARE_FEET: 'propertyAdmin.sizeUnit.squareFeet',
  HECTARES: 'propertyAdmin.sizeUnit.hectares',
  ACRES: 'propertyAdmin.sizeUnit.acres',
  CUBIC_METERS: 'propertyAdmin.sizeUnit.cubicMeters',
  LINEAR_METERS: 'propertyAdmin.sizeUnit.linearMeters',
  UNIT_COUNT: 'propertyAdmin.sizeUnit.unitCount',
  SHARES: 'propertyAdmin.sizeUnit.shares',
} as const satisfies Record<SizeUnitValue, string>;
export type SizeUnitTranslationKey = (typeof TRANSLATION_KEYS)[SizeUnitValue];

export const SizeUnit = {
  values: VALUES,

  parse(value: unknown): Result<SizeUnitValue, OrganizationDomainCode> {
    const unit = VALUES.find((candidate) => candidate === value);

    if (unit !== undefined) {
      return success(unit);
    }

    return failure(OrganizationDomainCodes.SIZE_UNIT_INVALID);
  },

  translationKey(value: SizeUnitValue): SizeUnitTranslationKey {
    return TRANSLATION_KEYS[value];
  },
};
