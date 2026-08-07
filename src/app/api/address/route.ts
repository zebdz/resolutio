import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { DaDataAddressProvider } from '@/infrastructure/address/DaDataAddressProvider';
import { NominatimAddressProvider } from '@/infrastructure/address/NominatimAddressProvider';
import { AddressProviderResolver } from '@/infrastructure/address/AddressProviderResolver';
import { AddressQuotaLogger } from '@/infrastructure/address/AddressQuotaLogger';
import {
  addressSuggestLimiter,
  ADDRESS_SUGGEST_MAX,
} from '@/infrastructure/rateLimit/registry';

// Explicit discriminator, not inference from which fields are present —
// inferring which mode was meant leaves "what if both query and houseLabel
// are set?" undefined. An unrecognised mode is rejected outright rather than
// falling through to a default (see parseLookupRequest).
type AddressLookupRequest =
  | { mode: 'address'; query: string }
  | { mode: 'flats'; houseLabel: string; fragment: string };

const quotaLogger = new AddressQuotaLogger();
const nominatim = new NominatimAddressProvider();
const daData = new DaDataAddressProvider(fetch, quotaLogger);
const resolver = new AddressProviderResolver(daData, nominatim);

const MIN_QUERY_LENGTH = 3;

// Account-wide DaData quota, deliberately not per-session: the quota belongs
// to our DaData account and is shared by every user.
const QUOTA_KEY = 'dadata:global';

function parseLookupRequest(body: unknown): AddressLookupRequest | null {
  if (typeof body !== 'object' || body === null || !('mode' in body)) {
    return null;
  }

  const { mode } = body as { mode: unknown };

  if (mode === 'address') {
    const { query } = body as { query?: unknown };

    return { mode: 'address', query: typeof query === 'string' ? query : '' };
  }

  if (mode === 'flats') {
    const { houseLabel, fragment } = body as {
      houseLabel?: unknown;
      fragment?: unknown;
    };

    return {
      mode: 'flats',
      houseLabel: typeof houseLabel === 'string' ? houseLabel : '',
      fragment: typeof fragment === 'string' ? fragment : '',
    };
  }

  return null;
}

async function handleAddressMode(query: string) {
  if (query.trim().length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

  const trimmedQuery = query.trim();
  const quota = addressSuggestLimiter.check(QUOTA_KEY);

  if (!quota.allowed) {
    // Our own daily cap tripped before DaData was even called. Skip DaData
    // entirely and serve Nominatim directly. Degraded — no apartment
    // suggestions — but the address form keeps working.
    await quotaLogger.logCapReached({
      route: 'suggest',
      dailyMax: ADDRESS_SUGGEST_MAX,
      retryAfterSeconds: quota.retryAfterSeconds ?? 0,
      fellBackToNominatim: true,
    });

    return NextResponse.json({
      suggestions: await nominatim.suggestAddress(trimmedQuery),
    });
  }

  // No try/catch here, deliberately: a missing DADATA_API_KEY throws (see
  // DaDataAddressProvider.query), and AddressProviderResolver does not catch
  // it either. Letting it propagate produces a 500 with the error logged
  // server-side by Next.js. Catching it and returning an empty list would
  // silently degrade a misconfigured deployment — exactly what the throw
  // was added (commit bb6d11f) to prevent. Unrelated to the 429/cap handling
  // above: a missing key is a misconfiguration we can fix; an exhausted
  // quota (ours or DaData's own 429) is expected operation.
  const suggestions = await resolver.suggest(trimmedQuery);

  return NextResponse.json({ suggestions });
}

async function handleFlatsMode(houseLabel: string, fragment: string) {
  if (!houseLabel.trim()) {
    return NextResponse.json({ flats: [] });
  }

  const quota = addressSuggestLimiter.check(QUOTA_KEY);

  if (!quota.allowed) {
    // Flats have no fallback — Nominatim has no apartment data at all — so
    // there is nothing to degrade to.
    await quotaLogger.logCapReached({
      route: 'flats',
      dailyMax: ADDRESS_SUGGEST_MAX,
      retryAfterSeconds: quota.retryAfterSeconds ?? 0,
      fellBackToNominatim: false,
    });

    return NextResponse.json({ flats: [] });
  }

  // No try/catch here, deliberately — same reasoning as address mode above:
  // a missing DADATA_API_KEY throws and propagates uncaught into a 500
  // logged server-side by Next.js, rather than a silently empty flat list.
  // Unrelated to the 429/cap handling above: a missing key is a
  // misconfiguration we can fix; an exhausted quota is expected operation.
  const flats = await daData.suggestFlats(houseLabel.trim(), fragment);

  return NextResponse.json({ flats });
}

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json(rateLimited, { status: 429 });
  }

  // Address lookup is only offered to signed-in users editing their profile
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    // Mode isn't known yet at this point in the flow — an empty object is
    // the only shape that fits either mode's response.
    return NextResponse.json({}, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const lookup = parseLookupRequest(body);

  if (!lookup) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  switch (lookup.mode) {
    case 'address':
      return handleAddressMode(lookup.query);
    case 'flats':
      return handleFlatsMode(lookup.houseLabel, lookup.fragment);
  }
}
