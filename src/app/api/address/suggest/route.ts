import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { DaDataAddressProvider } from '@/infrastructure/address/DaDataAddressProvider';
import { NominatimAddressProvider } from '@/infrastructure/address/NominatimAddressProvider';
import { AddressProviderResolver } from '@/infrastructure/address/AddressProviderResolver';

const resolver = new AddressProviderResolver(
  new DaDataAddressProvider(),
  new NominatimAddressProvider()
);

const MIN_QUERY_LENGTH = 3;

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

  // No try/catch here, deliberately: a missing DADATA_API_KEY throws (see
  // DaDataAddressProvider.query), and AddressProviderResolver does not catch
  // it either. Letting it propagate produces a 500 with the error logged
  // server-side by Next.js. Catching it and returning an empty list would
  // silently degrade a misconfigured deployment — exactly what the throw
  // was added (commit bb6d11f) to prevent.
  const suggestions = await resolver.suggest(query.trim());

  return NextResponse.json({ suggestions });
}
