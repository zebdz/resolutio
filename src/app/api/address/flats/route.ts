import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { DaDataAddressProvider } from '@/infrastructure/address/DaDataAddressProvider';
import { AddressQuotaLogger } from '@/infrastructure/address/AddressQuotaLogger';
import {
  addressSuggestLimiter,
  ADDRESS_SUGGEST_MAX,
} from '@/infrastructure/rateLimit/registry';

const quotaLogger = new AddressQuotaLogger();
const provider = new DaDataAddressProvider(fetch, quotaLogger);

// Account-wide DaData quota, deliberately not per-session: the quota belongs
// to our DaData account and is shared by every user.
const QUOTA_KEY = 'dadata:global';

export async function POST(request: NextRequest) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return NextResponse.json(rateLimited, { status: 429 });
  }

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ flats: [] }, { status: 401 });
  }

  const { houseLabel, fragment } = (await request.json()) as {
    houseLabel?: string;
    fragment?: string;
  };

  if (!houseLabel?.trim()) {
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

  // No try/catch here, deliberately — same reasoning as the suggest route:
  // a missing DADATA_API_KEY throws and propagates uncaught into a 500
  // logged server-side by Next.js, rather than a silently empty flat list.
  // Unrelated to the 429/cap handling above: a missing key is a
  // misconfiguration we can fix; an exhausted quota is expected operation.
  const flats = await provider.suggestFlats(houseLabel.trim(), fragment ?? '');

  return NextResponse.json({ flats });
}
