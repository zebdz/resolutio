'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { Input } from '@/app/components/catalyst/input';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import {
  addOrgAdminAction,
  removeOrgAdminAction,
  searchUsersForOrgAdminAction,
} from '@/web/actions/organization';
import { User } from '@/domain/user/User';
import { searchUserByPhoneAction } from '@/web/actions/user';
import { PhoneInput } from '@/web/components/phone';

type Admin = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
};

type SearchResult = Admin & { nickname: string };

type Props = {
  organizationId: string;
  admins: Admin[];
  currentUserId: string;
};

export function AdminManagementSection({
  organizationId,
  admins: initialAdmins,
  currentUserId,
}: Props) {
  const t = useTranslations('organization.modify');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Member search
  const [memberQuery, setMemberQuery] = useState('');
  const [memberResults, setMemberResults] = useState<SearchResult[]>([]);
  const [isMemberSearching, setIsMemberSearching] = useState(false);
  const [memberSearchError, setMemberSearchError] = useState<string | null>(
    null
  );

  // Non-member search
  const [nonMemberQuery, setNonMemberQuery] = useState('');
  const [nonMemberResults, setNonMemberResults] = useState<SearchResult[]>([]);
  const [isNonMemberSearching, setIsNonMemberSearching] = useState(false);
  const [nonMemberSearchError, setNonMemberSearchError] = useState<
    string | null
  >(null);

  const [addingId, setAddingId] = useState<string | null>(null);

  // Debounced member search
  const performMemberSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setMemberResults([]);
        setMemberSearchError(null);

        return;
      }

      setIsMemberSearching(true);
      setMemberSearchError(null);

      const result = await searchUsersForOrgAdminAction(
        organizationId,
        query,
        'members'
      );

      if (result.success) {
        setMemberResults(result.data);
      } else {
        setMemberSearchError(result.error);
        setMemberResults([]);
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
        setNonMemberSearchError(null);

        return;
      }

      setIsNonMemberSearching(true);
      setNonMemberSearchError(null);

      const result = await searchUsersForOrgAdminAction(
        organizationId,
        query,
        'non-members'
      );

      if (result.success) {
        setNonMemberResults(result.data);
      } else {
        setNonMemberSearchError(result.error);
        setNonMemberResults([]);
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

  const handleAddAdmin = async (userId: string) => {
    setAddingId(userId);
    setError(null);

    const result = await addOrgAdminAction(organizationId, userId);

    if (result.success) {
      setMemberQuery('');
      setMemberResults([]);
      setNonMemberQuery('');
      setNonMemberResults([]);
      router.refresh();
    } else {
      setError(result.error);
    }

    setAddingId(null);
  };

  const handleRemoveAdmin = async (userId: string) => {
    setRemovingId(userId);
    setError(null);

    const result = await removeOrgAdminAction(organizationId, userId);

    if (result.success) {
      setConfirmRemoveId(null);
      router.refresh();
    } else {
      setError(result.error);
    }

    setRemovingId(null);
  };

  function formatName(user: Admin) {
    return User.formatFullName(user.firstName, user.lastName, user.middleName);
  }

  return (
    <div className="space-y-6">
      <Heading level={2}>{t('adminSection')}</Heading>

      {error && <AlertBanner color="red">{error}</AlertBanner>}

      {/* Current admins list */}
      <div className="space-y-2">
        {initialAdmins.map((admin) => (
          <div
            key={admin.id}
            className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatName(admin)}
              </p>
            </div>
            {admin.id !== currentUserId && (
              <div className="flex items-center gap-2">
                {confirmRemoveId === admin.id ? (
                  <>
                    <Button
                      color="red"
                      onClick={() => handleRemoveAdmin(admin.id)}
                      disabled={removingId === admin.id}
                    >
                      {removingId === admin.id
                        ? t('removing')
                        : t('confirmRemove')}
                    </Button>
                    <Button
                      plain
                      onClick={() => setConfirmRemoveId(null)}
                      disabled={removingId === admin.id}
                    >
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    outline
                    onClick={() => setConfirmRemoveId(admin.id)}
                    disabled={initialAdmins.length <= 1 || removingId !== null}
                  >
                    {t('removeAdmin')}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {initialAdmins.length <= 1 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('lastAdminWarning')}
          </p>
        )}
      </div>

      {/* Add from members */}
      <SearchSection
        title={t('addAdminFromMembers')}
        query={memberQuery}
        onQueryChange={setMemberQuery}
        results={memberResults}
        isSearching={isMemberSearching}
        searchError={memberSearchError}
        addingId={addingId}
        onAdd={handleAddAdmin}
        showPhoneSearch={false}
        t={t}
      />

      {/* Add from non-members */}
      <SearchSection
        title={t('addAdminFromNonMembers')}
        query={nonMemberQuery}
        onQueryChange={setNonMemberQuery}
        results={nonMemberResults}
        isSearching={isNonMemberSearching}
        searchError={nonMemberSearchError}
        addingId={addingId}
        onAdd={handleAddAdmin}
        showPhoneSearch={true}
        t={t}
      />
    </div>
  );
}

function SearchSection({
  title,
  query,
  onQueryChange,
  results,
  isSearching,
  searchError,
  addingId,
  onAdd,
  showPhoneSearch,
  t,
}: {
  title: string;
  query: string;
  onQueryChange: (q: string) => void;
  results: SearchResult[];
  isSearching: boolean;
  searchError: string | null;
  addingId: string | null;
  onAdd: (userId: string) => void;
  showPhoneSearch: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [phoneQuery, setPhoneQuery] = useState('');
  const [phoneResult, setPhoneResult] = useState<SearchResult | null>(null);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const [phoneSearchError, setPhoneSearchError] = useState<string | null>(null);
  const [phoneSearchDone, setPhoneSearchDone] = useState(false);

  const handlePhoneSearch = async () => {
    if (!phoneQuery.trim()) {
      return;
    }

    setIsPhoneSearching(true);
    setPhoneSearchError(null);
    setPhoneResult(null);
    setPhoneSearchDone(false);

    const result = await searchUserByPhoneAction(phoneQuery.trim());

    if (result.success) {
      setPhoneResult(result.data);
      setPhoneSearchDone(true);
    } else {
      setPhoneSearchError(result.error);
    }

    setIsPhoneSearching(false);
  };

  function formatName(user: SearchResult) {
    const name = User.formatFullName(
      user.firstName,
      user.lastName,
      user.middleName
    );

    return `${name} (@${user.nickname})`;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>

      {/* Name/nickname search */}
      <Field>
        <Label>{t('searchPlaceholder')}</Label>
        <Input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          disabled={addingId !== null}
        />
      </Field>

      {query.trim().length > 0 && query.trim().length < 2 && (
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('searchMinChars')}
        </div>
      )}

      {isSearching && (
        <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">...</div>
      )}

      {searchError && (
        <div className="mt-4 text-sm text-red-600 dark:text-red-400">
          {searchError}
        </div>
      )}

      {!isSearching && query.trim().length >= 2 && results.length === 0 && (
        <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t('noResults')}
        </div>
      )}

      {results.length > 0 && (
        <div className="mt-4 space-y-2">
          {results.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {formatName(user)}
                </p>
              </div>
              <Button
                color="brand-green"
                onClick={() => onAdd(user.id)}
                disabled={addingId !== null}
              >
                {addingId === user.id ? t('adding') : t('addAdmin')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Phone search — separate section, only for non-members */}
      {showPhoneSearch && (
        <div className="mt-6 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <Field>
            <Label>{t('phoneSearchLabel')}</Label>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <PhoneInput
                  name="phoneSearch"
                  value={phoneQuery}
                  onChange={(e164) => {
                    setPhoneQuery(e164);
                    setPhoneSearchDone(false);
                    setPhoneResult(null);
                    setPhoneSearchError(null);
                  }}
                  disabled={addingId !== null || isPhoneSearching}
                />
              </div>
              <Button
                color="zinc"
                onClick={handlePhoneSearch}
                disabled={
                  addingId !== null || isPhoneSearching || phoneQuery.length < 5
                }
              >
                {isPhoneSearching
                  ? t('phoneSearchSearching')
                  : t('phoneSearchButton')}
              </Button>
            </div>
          </Field>

          {phoneSearchError && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              {phoneSearchError}
            </div>
          )}

          {phoneSearchDone && !phoneResult && (
            <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {t('phoneSearchNotFound')}
            </div>
          )}

          {phoneResult && (
            <div className="mt-4">
              <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800">
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {formatName(phoneResult)}
                  </p>
                </div>
                <Button
                  color="brand-green"
                  onClick={() => onAdd(phoneResult.id)}
                  disabled={addingId !== null}
                >
                  {addingId === phoneResult.id ? t('adding') : t('addAdmin')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
