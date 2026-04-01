'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { createOrgMemberInviteAction } from '@/src/web/actions/invitation/invitation';
import { searchUsersForOrgAdminAction } from '@/src/web/actions/organization/organization';
import { searchUserByPhoneAction } from '@/src/web/actions/user/user';
import { User } from '@/domain/user/User';
import { PhoneInput } from '@/src/web/components/shared/phone';

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname: string;
  address?: { city: string; street: string };
};

export function InviteMemberSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const t = useTranslations('manageMembers');
  const router = useRouter();

  // Name search state
  const [nameQuery, setNameQuery] = useState('');
  const [nameResults, setNameResults] = useState<SearchResult[]>([]);
  const [nameSearching, setNameSearching] = useState(false);

  // Phone search state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneResult, setPhoneResult] = useState<SearchResult | null>(null);
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [phoneNotFound, setPhoneNotFound] = useState(false);

  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchByName = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setNameResults([]);

        return;
      }

      setNameSearching(true);

      try {
        const result = await searchUsersForOrgAdminAction(
          organizationId,
          query,
          'non-members'
        );

        if (result.success) {
          setNameResults(
            result.data.map((u: any) => ({
              id: u.id,
              firstName: u.firstName,
              lastName: u.lastName,
              middleName: u.middleName,
              nickname: u.nickname,
              address: u.address,
            }))
          );
        }
      } finally {
        setNameSearching(false);
      }
    },
    [organizationId]
  );

  const searchByPhone = async () => {
    if (!phoneNumber) {
      return;
    }

    setPhoneSearching(true);
    setPhoneResult(null);
    setPhoneNotFound(false);

    try {
      const result = await searchUserByPhoneAction(phoneNumber);

      if (result.success && result.data) {
        setPhoneResult(result.data as SearchResult);
      } else {
        setPhoneNotFound(true);
      }
    } finally {
      setPhoneSearching(false);
    }
  };

  const handleInvite = async (userId: string) => {
    setInvitingId(userId);
    setError(null);

    try {
      const result = await createOrgMemberInviteAction(organizationId, userId);

      if (result.success) {
        setNameResults((prev) => prev.filter((u) => u.id !== userId));
        setPhoneResult(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setInvitingId(null);
    }
  };

  const handleNameChange = (value: string) => {
    setNameQuery(value);
    searchByName(value);
  };

  const formatName = (user: SearchResult) =>
    `${User.formatFullName(user.firstName, user.lastName, user.middleName)} (@${user.nickname})`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {t('inviteMember')}
      </h3>

      {error && (
        <AlertBanner color="red" className="mb-4">
          {error}
        </AlertBanner>
      )}

      {/* Name search */}
      <Field className="mb-4">
        <Label>{t('searchPlaceholder')}</Label>
        <Input
          value={nameQuery}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
        />
      </Field>

      {nameQuery.length > 0 && nameQuery.length < 2 && (
        <p className="mb-4 text-sm text-zinc-500">{t('searchMinChars')}</p>
      )}

      {nameSearching && (
        <p className="mb-4 text-sm text-zinc-500">
          {t('phoneSearchSearching')}
        </p>
      )}

      {nameResults.length > 0 && (
        <div className="mb-4 space-y-2">
          {nameResults.map((user) => (
            <div
              key={user.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div className="min-w-0">
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {formatName(user)}
                </span>
                {user.address && (
                  <p className="text-xs text-zinc-500">
                    {user.address.city}, {user.address.street}
                  </p>
                )}
              </div>
              <Button
                color="brand-green"
                onClick={() => handleInvite(user.id)}
                disabled={invitingId === user.id}
              >
                {invitingId === user.id ? t('inviting') : t('invite')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {nameQuery.length >= 2 && !nameSearching && nameResults.length === 0 && (
        <p className="mb-4 text-sm text-zinc-500">{t('noResults')}</p>
      )}

      {/* Phone search */}
      <Field className="mb-2">
        <Label>{t('phoneSearchLabel')}</Label>
        <div className="flex gap-2">
          <PhoneInput
            name="phone"
            value={phoneNumber}
            onChange={setPhoneNumber}
          />
          <Button
            color="zinc"
            onClick={searchByPhone}
            disabled={phoneSearching || !phoneNumber}
          >
            {phoneSearching
              ? t('phoneSearchSearching')
              : t('phoneSearchButton')}
          </Button>
        </div>
      </Field>

      {phoneNotFound && (
        <p className="mb-4 text-sm text-zinc-500">{t('phoneSearchNotFound')}</p>
      )}

      {phoneResult && (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800">
          <span className="text-sm text-zinc-900 dark:text-zinc-100">
            {formatName(phoneResult)}
          </span>
          <Button
            color="brand-green"
            onClick={() => handleInvite(phoneResult.id)}
            disabled={invitingId === phoneResult.id}
          >
            {invitingId === phoneResult.id ? t('inviting') : t('invite')}
          </Button>
        </div>
      )}
    </div>
  );
}
