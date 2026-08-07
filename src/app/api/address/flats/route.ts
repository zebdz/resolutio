import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { DaDataAddressProvider } from '@/infrastructure/address/DaDataAddressProvider';

const provider = new DaDataAddressProvider();

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

  // No try/catch here, deliberately — same reasoning as the suggest route:
  // a missing DADATA_API_KEY throws and propagates uncaught into a 500
  // logged server-side by Next.js, rather than a silently empty flat list.
  const flats = await provider.suggestFlats(houseLabel.trim(), fragment ?? '');

  return NextResponse.json({ flats });
}
