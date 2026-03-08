import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { UserManagementPanel } from './UserManagementPanel';

export default async function UsersPage() {
  const t = await getTranslations('superadmin.users');
  const tHub = await getTranslations('superadmin.hub');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/superadmin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; {tHub('back')}
        </Link>
        <Heading level={2} className="text-xl font-semibold">
          {t('title')}
        </Heading>
        <Text className="text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </Text>
      </div>

      <UserManagementPanel />
    </div>
  );
}
