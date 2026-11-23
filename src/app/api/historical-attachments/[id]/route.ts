/** Deliver immutable original bytes only after the owning question or poll permits access. */
import { getCurrentUser } from '@/web/lib/session';
import { readAsset } from '@/infrastructure/history/history';
import { HistoricalAssetKey } from '@/domain/history/HistoryIds';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const key = HistoricalAssetKey.safeParse((await params).id);

  if (!key.success) {
    return new Response(null, { status: 404 });
  }

  const asset = await readAsset((await getCurrentUser())?.id ?? null, key.data);

  if (!asset) {
    return new Response(null, { status: 404 });
  }

  const name = encodeURIComponent(asset.path.split('/').at(-1)!).replace(
    /['()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16)
  );
  const inline = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ].includes(asset.mime);

  return new Response(new Uint8Array(asset.bytes), {
    headers: {
      'content-type': asset.mime,
      'content-disposition':
        (inline ? 'inline' : 'attachment') + "; filename*=UTF-8''" + name,
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "sandbox; default-src 'none'",
    },
  });
}
