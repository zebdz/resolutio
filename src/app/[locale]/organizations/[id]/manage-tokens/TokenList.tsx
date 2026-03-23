'use client';

import { useTranslations, useLocale } from 'next-intl';
import {
  useState,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Switch, SwitchField } from '@/src/web/components/catalyst/switch';
import { Label } from '@/src/web/components/catalyst/fieldset';
import {
  getJoinTokensByOrgAction,
  expireJoinTokenAction,
  reactivateJoinTokenAction,
  updateJoinTokenMaxUsesAction,
} from '@/web/actions/joinToken';
import { toast } from 'sonner';

type TokenData = {
  id: string;
  organizationId: string;
  token: string;
  description: string;
  maxUses: number | null;
  useCount: number;
  createdById: string;
  createdAt: Date;
  expiredAt: Date | null;
  creatorName: string;
};

type TokenStatus = 'active' | 'expired' | 'exhausted';

function getTokenStatus(token: {
  expiredAt: Date | null;
  maxUses: number | null;
  useCount: number;
}): TokenStatus {
  if (token.expiredAt) {
    return 'expired';
  }

  if (token.maxUses !== null && token.useCount >= token.maxUses) {
    return 'exhausted';
  }

  return 'active';
}

const STATUS_BADGE_COLOR: Record<TokenStatus, 'green' | 'red' | 'yellow'> = {
  active: 'green',
  expired: 'red',
  exhausted: 'yellow',
};

const PAGE_SIZE = 10;

export type TokenListHandle = {
  refetch: () => void;
};

export const TokenList = forwardRef<
  TokenListHandle,
  {
    organizationId: string;
    initialTokens: TokenData[];
    initialTotalCount: number;
  }
>(function TokenList(
  { organizationId, initialTokens, initialTotalCount },
  ref
) {
  const t = useTranslations('joinToken.manage');
  const locale = useLocale();
  const [tokens, setTokens] = useState<TokenData[]>(initialTokens);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [editingTokenId, setEditingTokenId] = useState<string | null>(null);
  const [editMaxUses, setEditMaxUses] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTokens = useCallback(
    async (searchQuery: string, pageNum: number, onlyActive: boolean) => {
      setLoading(true);

      try {
        const result = await getJoinTokensByOrgAction(
          organizationId,
          searchQuery || undefined,
          pageNum,
          PAGE_SIZE,
          onlyActive ? true : undefined
        );

        if (result.success) {
          if (pageNum === 1) {
            setTokens(result.data.tokens);
          } else {
            setTokens((prev) => [...prev, ...result.data.tokens]);
          }

          setTotalCount(result.data.totalCount);
        }
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const refetch = useCallback(() => {
    setPage(1);
    fetchTokens(search, 1, !showInactive);
  }, [fetchTokens, search, showInactive]);

  useImperativeHandle(ref, () => ({ refetch }), [refetch]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchTokens(value, 1, !showInactive);
    }, 300);
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchTokens(search, nextPage, !showInactive);
  };

  const handleCopyLink = (tokenValue: string) => {
    const url = `${window.location.origin}/${locale}/join/${tokenValue}`;
    navigator.clipboard.writeText(url);
    toast.success(t('copySuccess'));
  };

  const handleExpire = async (tokenId: string) => {
    setActionInProgress(tokenId);

    try {
      const formData = new FormData();
      formData.set('tokenId', tokenId);
      const result = await expireJoinTokenAction(formData);

      if (result.success) {
        refetch();
      } else {
        toast.error(result.error);
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReactivate = async (tokenId: string) => {
    setActionInProgress(tokenId);

    try {
      const formData = new FormData();
      formData.set('tokenId', tokenId);
      const result = await reactivateJoinTokenAction(formData);

      if (result.success) {
        refetch();
      } else {
        toast.error(result.error);
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const handleStartEditMaxUses = (token: TokenData) => {
    setEditingTokenId(token.id);
    setEditMaxUses(token.maxUses !== null ? String(token.maxUses) : '');
  };

  const handleCancelEditMaxUses = () => {
    setEditingTokenId(null);
    setEditMaxUses('');
  };

  const handleSaveMaxUses = async (tokenId: string) => {
    setActionInProgress(tokenId);

    try {
      const formData = new FormData();
      formData.set('tokenId', tokenId);

      if (editMaxUses) {
        formData.set('maxUses', editMaxUses);
      }

      const result = await updateJoinTokenMaxUsesAction(formData);

      if (result.success) {
        setEditingTokenId(null);
        setEditMaxUses('');
        refetch();
      } else {
        toast.error(result.error);
      }
    } finally {
      setActionInProgress(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const hasMore = tokens.length < totalCount;

  return (
    <div>
      <Heading className="mb-4 text-lg font-semibold">{t('title')}</Heading>

      {/* Search + filter */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          type="search"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="sm:max-w-xs"
        />
        <SwitchField>
          <Label>{t('showInactive')}</Label>
          <Switch
            color="brand-green"
            checked={showInactive}
            onChange={(checked) => {
              setShowInactive(checked);
              setPage(1);
              fetchTokens(search, 1, !checked);
            }}
          />
        </SwitchField>
      </div>

      {/* Token list */}
      {tokens.length === 0 && !loading && (
        <Text className="text-zinc-500">{t('noTokens')}</Text>
      )}

      <div className="space-y-4">
        {tokens.map((token) => {
          const status = getTokenStatus(token);
          const isActioning = actionInProgress === token.id;
          const isEditing = editingTokenId === token.id;

          return (
            <div
              key={token.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Header: description + status badge */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {token.description}
                  </span>
                  <Badge color={STATUS_BADGE_COLOR[status]}>
                    {t(`status.${status}`)}
                  </Badge>
                </div>
              </div>

              {/* Token value */}
              <div className="mt-2">
                <code className="rounded bg-zinc-100 px-2 py-1 font-mono text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {token.token}
                </code>
              </div>

              {/* Meta info */}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                <span>
                  {t('table.created')}: {formatDate(token.createdAt)}
                </span>
                <span>
                  {t('table.creator')}: {token.creatorName}
                </span>
                <span>
                  {t('table.uses')}: {token.useCount}/
                  {token.maxUses !== null
                    ? token.maxUses
                    : t('table.unlimited')}
                </span>
              </div>

              {/* Max uses inline edit */}
              {isEditing && (
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    type="number"
                    value={editMaxUses}
                    onChange={(e) => setEditMaxUses(e.target.value)}
                    placeholder={t('maxUsesPlaceholder')}
                    min={1}
                    className="w-32"
                  />
                  <Button
                    color="brand-green"
                    onClick={() => handleSaveMaxUses(token.id)}
                    disabled={isActioning}
                  >
                    {t('save')}
                  </Button>
                  <Button
                    color="zinc"
                    onClick={handleCancelEditMaxUses}
                    disabled={isActioning}
                  >
                    {t('cancel')}
                  </Button>
                </div>
              )}

              {/* Actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  color="zinc"
                  onClick={() => handleCopyLink(token.token)}
                >
                  {t('copyLink')}
                </Button>

                {status === 'active' && (
                  <Button
                    color="red"
                    onClick={() => handleExpire(token.id)}
                    disabled={isActioning}
                  >
                    {t('expire')}
                  </Button>
                )}

                {status === 'expired' && (
                  <Button
                    color="brand-green"
                    onClick={() => handleReactivate(token.id)}
                    disabled={isActioning}
                  >
                    {t('reactivate')}
                  </Button>
                )}

                {!isEditing && (
                  <Button
                    color="zinc"
                    onClick={() => handleStartEditMaxUses(token)}
                    disabled={isActioning}
                  >
                    {t('editMaxUses')}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 text-center">
          <Button color="zinc" onClick={handleLoadMore} disabled={loading}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      {loading && (
        <Text className="mt-4 text-center text-zinc-500">{t('loading')}</Text>
      )}
    </div>
  );
});
