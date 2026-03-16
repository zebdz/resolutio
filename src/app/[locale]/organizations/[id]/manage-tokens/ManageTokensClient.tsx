'use client';

import { useRef } from 'react';
import { Divider } from '@/app/components/catalyst/divider';
import { CreateTokenSection } from './CreateTokenSection';
import { TokenList, TokenListHandle } from './TokenList';

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

export function ManageTokensClient({
  organizationId,
  initialTokens,
  initialTotalCount,
}: {
  organizationId: string;
  initialTokens: TokenData[];
  initialTotalCount: number;
}) {
  const tokenListRef = useRef<TokenListHandle>(null);

  return (
    <>
      <CreateTokenSection
        organizationId={organizationId}
        onCreated={() => tokenListRef.current?.refetch()}
      />

      <Divider />

      <TokenList
        ref={tokenListRef}
        organizationId={organizationId}
        initialTokens={initialTokens}
        initialTotalCount={initialTotalCount}
      />
    </>
  );
}
