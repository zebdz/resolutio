'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { createAdminInviteAction } from '@/web/actions/invitation';
import { searchUsersForOrgAdminAction } from '@/web/actions/organization';
import { searchUserByPhoneAction } from '@/web/actions/user';
import { User } from '@/domain/user/User';
import { PhoneInput } from '@/web/components/phone';

type SearchResult = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname: string;
};

export function InviteAdminSection({
  organizationId,
}: {
  organizationId: string;
}) {
  const t = useTranslations('manageAdmins');
  const router = useRouter();

  // Member search state
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<SearchResult[]>([]);
  const [isMemberSearching, setIsMemberSearching] = useState(false);

  // Non-member search state
  const [nonMemberQuery, setNonMemberQuery] = useState('');
  const [nonMemberResults, setNonMemberResults] = useState<SearchResult[]>([]);
  const [isNonMemberSearching, setIsNonMemberSearching] = useState(false);

  // Phone search state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneResult, setPhoneResult] = useState<SearchResult | null>(null);
  const [phoneSearching, setPhoneSearching] = useState(false);
  const [phoneNotFound, setPhoneNotFound] = useState(false);

  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Debounced member search
  const performMemberSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setMemberResults([]);

        return;
      }

      setIsMemberSearching(true);

      const result = await searchUsersForOrgAdminAction(
        organizationId,
        query,
        'members'
      );

      if (result.success) {
        setMemberResults(result.data);
      }

      setIsMemberSearching(false);
    },
    [organizationId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      performMemberSearch(memberQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [memberQuery, performMemberSearch]);

  // Debounced non-member search
  const performNonMemberSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setNonMemberResults([]);

        return;
      }

      setIsNonMemberSearching(true);

      const result = await searchUsersForOrgAdminAction(
        organizationId,
        query,
        'non-members'
      );

      if (result.success) {
        setNonMemberResults(result.data);
      }

      setIsNonMemberSearching(false);
    },
    [organizationId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      performNonMemberSearch(nonMemberQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [nonMemberQuery, performNonMemberSearch]);

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

  const handleInviteAdmin = async (userId: string) => {
    setInvitingId(userId);
    setError(null);

    const result = await createAdminInviteAction(organizationId, userId);

    if (result.success) {
      setMemberQuery('');
      setMemberResults([]);
      setNonMemberQuery('');
      setNonMemberResults([]);
      setPhoneResult(null);
      router.refresh();
    } else {
      setError(result.error);
    }

    setInvitingId(null);
  };

  const formatName = (user: SearchResult) =>
    `${User.formatFullName(user.firstName, user.lastName, user.middleName)} (@${user.nickname})`;

  return (
    <>
      {error && (
        <AlertBanner color="red" className="mb-4">
          {error}
        </AlertBanner>
      )}

      {/* Invite from members */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('inviteAdminFromMembers')}
        </h3>

        <Field className="mb-4">
          <Label>{t('searchPlaceholder')}</Label>
          <Input
            value={memberQuery}
            onChange={(e) => setMemberQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            disabled={invitingId !== null}
          />
        </Field>

        {memberQuery.trim().length > 0 && memberQuery.trim().length < 2 && (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t('searchMinChars')}
          </p>
        )}

        {isMemberSearching && (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">...</p>
        )}

        {memberResults.length > 0 && (
          <div className="space-y-2">
            {memberResults.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800"
              >
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {formatName(user)}
                </span>
                <Button
                  className="w-full sm:w-auto"
                  color="brand-green"
                  onClick={() => handleInviteAdmin(user.id)}
                  disabled={invitingId !== null}
                >
                  {invitingId === user.id ? t('inviting') : t('inviteAdmin')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {memberQuery.trim().length >= 2 &&
          !isMemberSearching &&
          memberResults.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('noResults')}
            </p>
          )}
      </div>

      {/* Invite from non-members */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('inviteAdminFromNonMembers')}
        </h3>

        {/* Name search */}
        <Field className="mb-4">
          <Label>{t('searchPlaceholder')}</Label>
          <Input
            value={nonMemberQuery}
            onChange={(e) => setNonMemberQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            disabled={invitingId !== null}
          />
        </Field>

        {nonMemberQuery.trim().length > 0 &&
          nonMemberQuery.trim().length < 2 && (
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              {t('searchMinChars')}
            </p>
          )}

        {isNonMemberSearching && (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">...</p>
        )}

        {nonMemberResults.length > 0 && (
          <div className="mb-4 space-y-2">
            {nonMemberResults.map((user) => (
              <div
                key={user.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800"
              >
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {formatName(user)}
                </span>
                <Button
                  className="w-full sm:w-auto"
                  color="brand-green"
                  onClick={() => handleInviteAdmin(user.id)}
                  disabled={invitingId !== null}
                >
                  {invitingId === user.id ? t('inviting') : t('inviteAdmin')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {nonMemberQuery.trim().length >= 2 &&
          !isNonMemberSearching &&
          nonMemberResults.length === 0 && (
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              {t('noResults')}
            </p>
          )}

        {/* Phone search */}
        <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <Field className="mb-2">
            <Label>{t('phoneSearchLabel')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="w-full sm:flex-1">
                <PhoneInput
                  name="phoneSearch"
                  value={phoneNumber}
                  onChange={(e164) => {
                    setPhoneNumber(e164);
                    setPhoneNotFound(false);
                    setPhoneResult(null);
                  }}
                  disabled={invitingId !== null || phoneSearching}
                />
              </div>
              <Button
                className="w-full sm:w-auto"
                color="zinc"
                onClick={searchByPhone}
                disabled={
                  invitingId !== null ||
                  phoneSearching ||
                  phoneNumber.length < 5
                }
              >
                {phoneSearching
                  ? t('phoneSearchSearching')
                  : t('phoneSearchButton')}
              </Button>
            </div>
          </Field>

          {phoneNotFound && (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t('phoneSearchNotFound')}
            </p>
          )}

          {phoneResult && (
            <div className="mt-4">
              <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800">
                <span className="text-sm text-zinc-900 dark:text-zinc-100">
                  {formatName(phoneResult)}
                </span>
                <Button
                  className="w-full sm:w-auto"
                  color="brand-green"
                  onClick={() => handleInviteAdmin(phoneResult.id)}
                  disabled={invitingId !== null}
                >
                  {invitingId === phoneResult.id
                    ? t('inviting')
                    : t('inviteAdmin')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
