import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { CreatePollForm } from './CreatePollForm';

export default function CreatePollPage() {
  return (
    <AuthenticatedLayout>
      <CreatePollForm />
    </AuthenticatedLayout>
  );
}
