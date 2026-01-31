import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { EditPollForm } from './EditPollForm';

export default function EditPollPage() {
  return (
    <AuthenticatedLayout>
      <EditPollForm />
    </AuthenticatedLayout>
  );
}
