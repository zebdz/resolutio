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

type User = {
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phoneNumber: string;
};

type AddOutsideMemberSectionProps = {
  boardId: string;
  isGeneral: boolean;
};

export default function AddOutsideMemberSection({
  boardId,
  isGeneral,
}: AddOutsideMemberSectionProps) {
  const t = useTranslations('organization.boards.manageSingle');
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Debounced search
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
    }, 500); // 500ms debounce

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
      setIsAdding(false);
      router.refresh();
    } else {
      setError(result.error);
      setIsAdding(false);
    }
  };

  // Don't show this section for general boards
  if (isGeneral) {
    return null;
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        {t('addOutsideMember')}
      </h3>

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
                  {user.firstName} {user.middleName && `${user.middleName} `}
                  {user.lastName}
                </p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {user.phoneNumber}
                </p>
              </div>
              <Button
                color="indigo"
                onClick={() => handleAdd(user.id)}
                disabled={isAdding}
              >
                {isAdding ? t('adding') : t('add')}
              </Button>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
