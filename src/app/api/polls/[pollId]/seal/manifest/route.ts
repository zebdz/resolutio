/** Download the manifest evidence for one sealed poll through the shared disclosure boundary. */
import { sealDownload } from '@/web/lib/sealDownload';
export const GET = sealDownload('manifest');
