'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import { Button } from '@/app/components/catalyst/button';
import { Text } from '@/app/components/catalyst/text';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/catalyst/table';
import { cancelJoinParentRequestAction } from '@/web/actions/joinParentRequest';
import type { EnrichedJoinParentRequest } from '@/web/actions/joinParentRequest';

interface OutgoingRequestsTableProps {
  requests: EnrichedJoinParentRequest[];
}

function StatusBadge({
  status,
}: {
  status: 'pending' | 'accepted' | 'rejected';
}) {
  const t = useTranslations('organization.joinParent');
  const colorMap = {
    pending: 'amber',
    accepted: 'green',
    rejected: 'red',
  } as const;
  const labelMap = {
    pending: t('statusPending'),
    accepted: t('statusAccepted'),
    rejected: t('statusRejected'),
  };

  return <Badge color={colorMap[status]}>{labelMap[status]}</Badge>;
}

export function OutgoingRequestsTable({
  requests: initialRequests,
}: OutgoingRequestsTableProps) {
  const t = useTranslations('organization.joinParent');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async (requestId: string) => {
    setIsProcessing(true);
    setError(null);

    const result = await cancelJoinParentRequestAction(requestId);

    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      router.refresh();
    } else {
      setError(result.error);
    }

    setIsProcessing(false);
  };

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <Text className="text-lg text-zinc-500 dark:text-zinc-400">
          {t('noOutgoingRequests')}
        </Text>
        <Text className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
          {t('noOutgoingRequestsDescription')}
        </Text>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{error}</Text>
        </div>
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeader>{tCommon('actions')}</TableHeader>
            <TableHeader>{t('columnStatus')}</TableHeader>
            <TableHeader>{t('columnParentOrg')}</TableHeader>
            <TableHeader>{t('requestingAdmin')}</TableHeader>
            <TableHeader className="hidden sm:table-cell">
              {t('requestMessage')}
            </TableHeader>
            <TableHeader className="hidden sm:table-cell">
              {t('columnHandlingAdmin')}
            </TableHeader>
            <TableHeader className="hidden md:table-cell">
              {t('columnRejectionReason')}
            </TableHeader>
            <TableHeader className="hidden sm:table-cell">
              {t('requestedAt')}
            </TableHeader>
            <TableHeader className="hidden md:table-cell">
              {t('columnHandledAt')}
            </TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                {request.status === 'pending' && (
                  <Button
                    color="red"
                    onClick={() => handleCancel(request.id)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? t('cancelling') : t('cancelRequest')}
                  </Button>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
              <TableCell>{request.parentOrgName}</TableCell>
              <TableCell>{request.requestingAdminName}</TableCell>
              <TableCell className="hidden max-w-xs truncate sm:table-cell">
                {request.message}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {request.handlingAdminName ?? '—'}
              </TableCell>
              <TableCell className="hidden max-w-xs truncate md:table-cell">
                {request.rejectionReason ?? '—'}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {new Date(request.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {request.handledAt
                  ? new Date(request.handledAt).toLocaleDateString()
                  : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
