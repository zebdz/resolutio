'use client';

import { useRef } from 'react';
import { Divider } from '@/src/web/components/catalyst/divider';
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
  organizationName,
  initialTokens,
  initialTotalCount,
}: {
  organizationId: string;
  organizationName: string;
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
        organizationName={organizationName}
        initialTokens={initialTokens}
        initialTotalCount={initialTotalCount}
      />
    </>
  );
}
