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

const quotaLogger = new AddressQuotaLogger();
const nominatim = new NominatimAddressProvider();
const resolver = new AddressProviderResolver(
  new DaDataAddressProvider(fetch, quotaLogger),
  nominatim
);

const MIN_QUERY_LENGTH = 3;

// Account-wide DaData quota, deliberately not per-session: the quota belongs
// to our DaData account and is shared by every user.
const QUOTA_KEY = 'dadata:global';

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json(rateLimited, { status: 429 });
  }

  // Address lookup is only offered to signed-in users editing their profile
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ suggestions: [] }, { status: 401 });
  }

  const { query } = (await request.json()) as { query?: string };

  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    return NextResponse.json({ suggestions: [] });
  }

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
      suggestions: await nominatim.suggestAddress(query.trim()),
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
  const suggestions = await resolver.suggest(query.trim());

  return NextResponse.json({ suggestions });
}
