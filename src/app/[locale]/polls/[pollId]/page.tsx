import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { EditPollForm } from './edit/EditPollForm';

/**
 * The poll as something to read rather than change: what an admin opens to
 * review a submitted poll, run the legality check, and decide whether to
 * freeze participants — none of which is editing, so none of it belongs
 * behind an /edit URL.
 *
 * Shares EditPollForm with the edit route because the read-only rendering,
 * the legality panel and the lifecycle controls already live there and must
 * stay identical on both. `readOnly` only forces the view; who may see the
 * poll at all is still decided from the server's permissions.
 */
export default function PollPage() {
  return (
    <AuthenticatedLayout>
      <EditPollForm readOnly />
    </AuthenticatedLayout>
  );
}
