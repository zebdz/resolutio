import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { CreatePollForm } from './CreatePollForm';

export default function CreatePollPage() {
  return (
    <AuthenticatedLayout>
      <CreatePollForm />
    </AuthenticatedLayout>
  );
}
