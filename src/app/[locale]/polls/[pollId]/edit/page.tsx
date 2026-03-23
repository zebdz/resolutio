import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { EditPollForm } from './EditPollForm';

export default function EditPollPage() {
  return (
    <AuthenticatedLayout>
      <EditPollForm />
    </AuthenticatedLayout>
  );
}
