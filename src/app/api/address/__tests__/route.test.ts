import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockCheckRateLimit = vi.fn();
const mockLimiterCheck = vi.fn();
const mockResolverSuggest = vi.fn();
const mockSuggestFlats = vi.fn();
const mockNominatimSuggestAddress = vi.fn();
const mockLogCapReached = vi.fn();

// Distinctive, not the real 9_500, so an assertion against it proves the
// route forwards the imported constant rather than a coincidentally
// matching literal.
const MOCK_DAILY_MAX = 4242;

vi.mock('@/web/lib/session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/web/actions/rateLimit', () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock('@/infrastructure/rateLimit/registry', () => ({
  addressSuggestLimiter: { check: mockLimiterCheck },
  ADDRESS_SUGGEST_MAX: MOCK_DAILY_MAX,
}));

vi.mock('@/infrastructure/address/AddressProviderResolver', () => ({
  AddressProviderResolver: class {
    suggest = mockResolverSuggest;
  },
}));

vi.mock('@/infrastructure/address/DaDataAddressProvider', () => ({
  DaDataAddressProvider: class {
    suggestFlats = mockSuggestFlats;
  },
}));

vi.mock('@/infrastructure/address/NominatimAddressProvider', () => ({
  NominatimAddressProvider: class {
    suggestAddress = mockNominatimSuggestAddress;
  },
}));

vi.mock('@/infrastructure/address/AddressQuotaLogger', () => ({
  AddressQuotaLogger: class {
    logCapReached = mockLogCapReached;
  },
}));

const { POST } = await import('../route');

// The route only ever calls request.json() — a hand-built object exposing
// that one method is enough, no real NextRequest needed.
function makeRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest;
}

function makeMalformedRequest(): NextRequest {
  return {
    json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
  } as unknown as NextRequest;
}

describe('POST /api/address', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue(null);
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' });
    mockLimiterCheck.mockReturnValue({
      allowed: true,
      retryAfterSeconds: 0,
      remaining: 100,
    });
    mockResolverSuggest.mockResolvedValue([]);
    mockSuggestFlats.mockResolvedValue([]);
    mockNominatimSuggestAddress.mockResolvedValue([]);
  });

  it('returns 429 and never calls the resolver when rate limited', async () => {
    const rateLimited = { success: false, error: 'rateLimit.tooManyRequests' };
    mockCheckRateLimit.mockResolvedValue(rateLimited);

    const response = await POST(
      makeRequest({ mode: 'address', query: 'Ростов-на-Дону' })
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual(rateLimited);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
    expect(mockResolverSuggest).not.toHaveBeenCalled();
  });

  it('returns 401 and never calls the resolver when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ mode: 'address', query: 'Ростов-на-Дону' })
    );

    expect(response.status).toBe(401);
    expect(mockResolverSuggest).not.toHaveBeenCalled();
  });

  it('checks the quota guard with the global DaData key before calling the provider', async () => {
    const response = await POST(
      makeRequest({ mode: 'address', query: 'Ростов-на-Дону' })
    );

    expect(response.status).toBe(200);
    expect(mockLimiterCheck).toHaveBeenCalledWith('dadata:global');
    expect(mockLimiterCheck.mock.invocationCallOrder[0]).toBeLessThan(
      mockResolverSuggest.mock.invocationCallOrder[0]
    );
  });

  it('falls back to Nominatim in address mode when quota is exhausted, and logs the cap event', async () => {
    mockLimiterCheck.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 120,
      remaining: 0,
    });
    mockNominatimSuggestAddress.mockResolvedValue([{ label: 'nominatim-hit' }]);

    const response = await POST(
      makeRequest({ mode: 'address', query: 'Ростов-на-Дону' })
    );
    const body = await response.json();

    expect(mockResolverSuggest).not.toHaveBeenCalled();
    expect(mockNominatimSuggestAddress).toHaveBeenCalledWith('Ростов-на-Дону');
    expect(body).toEqual({ suggestions: [{ label: 'nominatim-hit' }] });
    expect(mockLogCapReached).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'suggest',
        dailyMax: MOCK_DAILY_MAX,
        fellBackToNominatim: true,
      })
    );
  });

  it('returns empty flats without calling Nominatim when quota is exhausted', async () => {
    mockLimiterCheck.mockReturnValue({
      allowed: false,
      retryAfterSeconds: 120,
      remaining: 0,
    });

    const response = await POST(
      makeRequest({
        mode: 'flats',
        houseLabel: 'г Ростов-на-Дону, д 13',
        fragment: '2',
      })
    );
    const body = await response.json();

    expect(body).toEqual({ flats: [] });
    expect(mockNominatimSuggestAddress).not.toHaveBeenCalled();
    expect(mockSuggestFlats).not.toHaveBeenCalled();
    expect(mockLogCapReached).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'flats',
        dailyMax: MOCK_DAILY_MAX,
        fellBackToNominatim: false,
      })
    );
  });

  it('routes address mode to the resolver', async () => {
    mockResolverSuggest.mockResolvedValue([{ label: 'resolver-hit' }]);

    const response = await POST(
      makeRequest({ mode: 'address', query: 'Гвардейский' })
    );
    const body = await response.json();

    expect(mockResolverSuggest).toHaveBeenCalledWith('Гвардейский');
    expect(body).toEqual({ suggestions: [{ label: 'resolver-hit' }] });
  });

  it('routes flats mode to suggestFlats with houseLabel and fragment', async () => {
    mockSuggestFlats.mockResolvedValue([{ flat: '12' }]);

    const response = await POST(
      makeRequest({
        mode: 'flats',
        houseLabel: 'г Ростов-на-Дону, д 13',
        fragment: '1',
      })
    );
    const body = await response.json();

    expect(mockSuggestFlats).toHaveBeenCalledWith(
      'г Ростов-на-Дону, д 13',
      '1'
    );
    expect(body).toEqual({ flats: [{ flat: '12' }] });
  });

  it('returns empty suggestions for a too-short query without consuming quota', async () => {
    const response = await POST(makeRequest({ mode: 'address', query: 'Ро' }));
    const body = await response.json();

    expect(body).toEqual({ suggestions: [] });
    expect(mockLimiterCheck).not.toHaveBeenCalled();
  });

  it('returns empty flats for a blank houseLabel without consuming quota', async () => {
    const response = await POST(
      makeRequest({ mode: 'flats', houseLabel: '   ', fragment: '1' })
    );
    const body = await response.json();

    expect(body).toEqual({ flats: [] });
    expect(mockLimiterCheck).not.toHaveBeenCalled();
  });

  it('returns 400, not 500, for a malformed JSON body', async () => {
    const response = await POST(makeMalformedRequest());

    expect(response.status).toBe(400);
  });

  it('returns 400 for an unrecognized mode', async () => {
    const response = await POST(makeRequest({ mode: 'bogus' }));

    expect(response.status).toBe(400);
  });
});
