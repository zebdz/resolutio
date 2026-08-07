import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AddressDomainCodes } from '@/src/domain/user/Address';

/**
 * Regression tests for a production bug: submitting the address form with
 * only `street` filled (country/city/building empty) returned a "success"
 * message but silently wrote nothing. Root cause: the action gated building
 * the address object on `addressCountry` being truthy, so an empty country
 * collapsed the whole address to `undefined` ("not submitted") instead of
 * reaching Zod validation ("submitted but incomplete").
 *
 * Uses the REAL UpdateUserProfileSchema (not mocked) so Zod validation
 * actually runs — that's the only way to prove field-level errors surface.
 */

const mockGetCurrentUser = vi.fn();
const mockUpdateUserProfileExecute = vi.fn();

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(null),
  checkPhoneSearchRateLimit: vi.fn().mockResolvedValue(null),
  recordFailedPhoneSearch: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaUserRepository: class {},
}));

vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: {
    getInstance: vi.fn().mockReturnValue({
      containsProfanity: () => false,
      findProfaneWords: () => [],
    }),
  },
}));

vi.mock('@/src/application/user/UpdateUserProfileUseCase', () => ({
  UpdateUserProfileUseCase: class {
    execute = mockUpdateUserProfileExecute;
  },
}));

vi.mock('@/src/application/user/CompletePrivacySetupUseCase', () => ({
  CompletePrivacySetupUseCase: class {},
}));

const { updateProfileAction } = await import('../user/user');

// Mirrors AddressForm.tsx's handleSubmit, which always sets every
// addressXxx field on the FormData (empty string for untouched fields).
function baseAddressFields(
  overrides: Record<string, string> = {}
): Record<string, string> {
  return {
    addressCountry: '',
    addressRegion: '',
    addressCity: '',
    addressStreet: '',
    addressBuilding: '',
    addressApartment: '',
    addressPostalCode: '',
    addressIsPrivateHouse: 'false',
    addressOneLine: '',
    addressHouseFiasId: '',
    addressFlatFiasId: '',
    ...overrides,
  };
}

function formDataFrom(fields: Record<string, string>): FormData {
  const fd = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    fd.set(key, value);
  }

  return fd;
}

describe('updateProfileAction - address handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a save with only street filled and names the missing fields (reported bug)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateUserProfileExecute.mockResolvedValue({
      success: true,
      value: {},
    });

    const formData = formDataFrom({
      addressAction: 'save',
      ...baseAddressFields({ addressStreet: 'test' }),
    });

    const result = await updateProfileAction(formData);

    expect(result.success).toBe(false);
    expect(mockUpdateUserProfileExecute).not.toHaveBeenCalled();

    if (!result.success) {
      expect(result.fieldErrors?.['address.country']).toEqual([
        AddressDomainCodes.COUNTRY_REQUIRED.replace('domain.', ''),
      ]);
      expect(result.fieldErrors?.['address.city']).toEqual([
        AddressDomainCodes.CITY_REQUIRED.replace('domain.', ''),
      ]);
      expect(result.fieldErrors?.['address.building']).toEqual([
        AddressDomainCodes.BUILDING_REQUIRED.replace('domain.', ''),
      ]);
      // The one field that WAS filled in must not be reported as an error.
      expect(result.fieldErrors?.['address.street']).toBeUndefined();
    }
  });

  it('leaves the address untouched when no addressAction is present (AccountForm case)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateUserProfileExecute.mockResolvedValue({
      success: true,
      value: {},
    });

    const formData = new FormData();
    formData.set('nickname', 'newnick');
    // No addressAction and no address fields at all - this is what
    // AccountForm posts today.

    const result = await updateProfileAction(formData);

    expect(result.success).toBe(true);
    expect(mockUpdateUserProfileExecute).toHaveBeenCalledTimes(1);

    const input = mockUpdateUserProfileExecute.mock.calls[0][0];
    expect(input.address).toBeUndefined();
    expect(input.nickname).toBe('newnick');
  });

  it('clears the address when addressAction is "clear"', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateUserProfileExecute.mockResolvedValue({
      success: true,
      value: {},
    });

    const formData = new FormData();
    formData.set('addressAction', 'clear');

    const result = await updateProfileAction(formData);

    expect(result.success).toBe(true);

    const input = mockUpdateUserProfileExecute.mock.calls[0][0];
    expect(input.address).toBeNull();
  });

  it('rejects a save with addressAction=save and no address fields at all, instead of persisting the literal string "null" (data-integrity bug)', async () => {
    // String(formData.get('addressCountry')) is String(null) = "null" when the
    // key is entirely absent — a non-empty string that used to sail past Zod's
    // .min(1). Deliberately does NOT go through baseAddressFields(), which
    // always sets every key (even to ''): this reproduces a request that omits
    // the address keys entirely, per the reported bug.
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateUserProfileExecute.mockResolvedValue({
      success: true,
      value: {},
    });

    const formData = new FormData();
    formData.set('addressAction', 'save');

    const result = await updateProfileAction(formData);

    expect(result.success).toBe(false);
    expect(mockUpdateUserProfileExecute).not.toHaveBeenCalled();

    if (!result.success) {
      expect(result.fieldErrors?.['address.country']).toEqual([
        AddressDomainCodes.COUNTRY_REQUIRED.replace('domain.', ''),
      ]);
      expect(result.fieldErrors?.['address.city']).toEqual([
        AddressDomainCodes.CITY_REQUIRED.replace('domain.', ''),
      ]);
      expect(result.fieldErrors?.['address.street']).toEqual([
        AddressDomainCodes.STREET_REQUIRED.replace('domain.', ''),
      ]);
      expect(result.fieldErrors?.['address.building']).toEqual([
        AddressDomainCodes.BUILDING_REQUIRED.replace('domain.', ''),
      ]);
    }
  });

  it('reaches the use case with the full address on a complete save (happy path)', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockUpdateUserProfileExecute.mockResolvedValue({
      success: true,
      value: {},
    });

    const formData = formDataFrom({
      addressAction: 'save',
      ...baseAddressFields({
        addressCountry: 'Россия',
        addressCity: 'Ростов-на-Дону',
        addressStreet: 'Гвардейский пер',
        addressBuilding: '13',
        // Private house: apartment is not required.
        addressIsPrivateHouse: 'true',
      }),
    });

    const result = await updateProfileAction(formData);

    expect(result.success).toBe(true);

    const input = mockUpdateUserProfileExecute.mock.calls[0][0];
    expect(input.address).toEqual({
      country: 'Россия',
      region: undefined,
      city: 'Ростов-на-Дону',
      street: 'Гвардейский пер',
      building: '13',
      apartment: undefined,
      postalCode: undefined,
      isPrivateHouse: true,
      oneLine: undefined,
      houseFiasId: undefined,
      flatFiasId: undefined,
    });
  });
});
