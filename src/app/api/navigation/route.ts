/** Supply verification pages with viewer-specific navigation outside the React server render. */
import { getSiteNavigation } from '@/web/lib/getSiteNavigation';

const headers = { 'Cache-Control': 'private, no-store' };

export async function GET() {
  const navigation = await getSiteNavigation();

  if (!navigation.success) {
    return new Response(null, { status: 503, headers });
  }

  if ('redirect' in navigation.value) {
    return new Response(null, { status: 204, headers });
  }

  return Response.json(navigation.value, { headers });
}
