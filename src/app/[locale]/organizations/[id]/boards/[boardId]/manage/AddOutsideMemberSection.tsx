'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { Input } from '@/app/components/catalyst/input';
import {
  addBoardMemberAction,
  searchUsersForBoardAction,
} from '@/web/actions/board';
import { searchUserByPhoneAction } from '@/web/actions/user';
import { User } from '@/domain/user/User';
import { PhoneInput } from '@/web/components/phone';

type UserResult = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname: string;
};

type AddOutsideMemberSectionProps = {
  boardId: string;
};

export default function AddOutsideMemberSection({
  boardId,
}: AddOutsideMemberSectionProps) {
  const t = useTranslations('organization.boards.manageSingle');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Phone search state
  const [phoneQuery, setPhoneQuery] = useState('');
  const [phoneResult, setPhoneResult] = useState<UserResult | null>(null);
  const [isPhoneSearching, setIsPhoneSearching] = useState(false);
  const [phoneSearchError, setPhoneSearchError] = useState<string | null>(null);
  const [phoneSearchDone, setPhoneSearchDone] = useState(false);

  // Debounced name/nickname search
  const performSearch = useCallback(
    async (query: string) => {
      if (!query || query.trim().length < 2) {
        setSearchResults([]);
        setSearchError(null);

        return;
      }

      setIsSearching(true);
      setSearchError(null);

      const result = await searchUsersForBoardAction(boardId, query);

      if (result.success) {
        setSearchResults(result.data);
      } else {
        setSearchError(result.error);
        setSearchResults([]);
      }

      setIsSearching(false);
    },
    [boardId]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleAdd = async (userId: string) => {
    setIsAdding(true);
    setError(null);

    const formData = new FormData();
    formData.append('boardId', boardId);
    formData.append('userId', userId);

    const result = await addBoardMemberAction(formData);

    if (result.success) {
      setSearchQuery('');
      setSearchResults([]);
      setPhoneQuery('');
      setPhoneResult(null);
      setPhoneSearchDone(false);
      setIsAdding(false);
      router.refresh();
    } else {
      setError(result.error);
      setIsAdding(false);
    }
  };

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

  function formatName(user: UserResult) {
    const name = User.formatFullName(
      user.firstName,
      user.lastName,
      user.middleName
    );

    return `${name} (@${user.nickname})`;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        {t('addOutsideMember')}
      </h3>

      {/* Name/nickname search */}
      <Field>
        <Label>{t('searchPlaceholder')}</Label>
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          disabled={isAdding}
        />
      </Field>

      {searchQuery.trim().length > 0 && searchQuery.trim().length < 2 && (
        <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {t('minSearchLength')}
        </div>
      )}

      {isSearching && (
        <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t('searching')}
        </div>
      )}

      {searchError && (
        <div className="mt-4 text-sm text-red-600 dark:text-red-400">
          {searchError}
        </div>
      )}

      {!isSearching &&
        searchQuery.trim().length >= 2 &&
        searchResults.length === 0 && (
          <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            {t('noResults')}
          </div>
        )}

      {searchResults.length > 0 && (
        <div className="mt-4 space-y-2">
          {searchResults.map((user) => (
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
                onClick={() => handleAdd(user.id)}
                disabled={isAdding}
              >
                {isAdding ? t('adding') : t('add')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Phone search — separate section */}
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
                disabled={isAdding || isPhoneSearching}
              />
            </div>
            <Button
              color="zinc"
              onClick={handlePhoneSearch}
              disabled={isAdding || isPhoneSearching || phoneQuery.length < 5}
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
                onClick={() => handleAdd(phoneResult.id)}
                disabled={isAdding}
              >
                {isAdding ? t('adding') : t('add')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
