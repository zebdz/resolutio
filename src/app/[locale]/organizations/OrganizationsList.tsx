'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Input } from '@/app/components/catalyst/input';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Badge } from '@/app/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import { joinOrganizationAction } from '@/web/actions/organization';

interface Organization {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  firstAdmin: { id: string; firstName: string; lastName: string } | null;
}

interface OrganizationsListProps {
  organizations: Organization[];
  userId: string;
}

export function OrganizationsList({ organizations }: OrganizationsListProps) {
  const t = useTranslations('organization.list');
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState('');
  const [joiningOrgId, setJoiningOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const filteredOrganizations = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleJoin = async (organizationId: string) => {
    setJoiningOrgId(organizationId);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('organizationId', organizationId);

    const result = await joinOrganizationAction(formData);

    if (result.success) {
      setSuccess(t('joinSuccess'));
      router.refresh();
    } else {
      setError(result.error);
    }

    setJoiningOrgId(null);
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder={t('search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/10">
          <p className="text-sm text-green-800 dark:text-green-200">
            {success}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Organizations Grid */}
      {filteredOrganizations.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <Text className="text-lg text-zinc-500 dark:text-zinc-400">
            {searchTerm ? 'No organizations found' : t('noOrganizations')}
          </Text>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredOrganizations.map((org) => (
            <div
              key={org.id}
              className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="space-y-4">
                <Link href={`/organizations/${org.id}`}>
                  <Heading
                    level={3}
                    className="text-lg font-semibold hover:text-blue-600 dark:hover:text-blue-400"
                  >
                    {org.name}
                  </Heading>
                </Link>
                <Text className="line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {org.description}
                </Text>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge color="zinc">
                      {t('memberCount', { count: org.memberCount })}
                    </Badge>
                  </div>

                  {org.firstAdmin && (
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('admin')}: {org.firstAdmin.firstName}{' '}
                      {org.firstAdmin.lastName}
                    </Text>
                  )}
                </div>

                <Button
                  color="blue"
                  className="w-full"
                  onClick={() => handleJoin(org.id)}
                  disabled={joiningOrgId === org.id}
                >
                  {joiningOrgId === org.id ? t('joining') : t('joinButton')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
