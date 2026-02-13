'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import { Button } from '@/app/components/catalyst/button';
import { Text } from '@/app/components/catalyst/text';
import { Textarea } from '@/app/components/catalyst/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/catalyst/table';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { handleJoinParentRequestAction } from '@/web/actions/joinParentRequest';
import type { EnrichedJoinParentRequest } from '@/web/actions/joinParentRequest';

interface IncomingRequestsTableProps {
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

export function IncomingRequestsTable({
  requests: initialRequests,
}: IncomingRequestsTableProps) {
  const t = useTranslations('organization.joinParent');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] =
    useState<EnrichedJoinParentRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (request: EnrichedJoinParentRequest) => {
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('requestId', request.id);
    formData.append('action', 'accept');

    const result = await handleJoinParentRequestAction(formData);

    if (result.success) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === request.id ? { ...r, status: 'accepted' as const } : r
        )
      );
      router.refresh();
    } else {
      setError(result.error);
    }

    setIsProcessing(false);
  };

  const handleRejectClick = (request: EnrichedJoinParentRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('requestId', selectedRequest.id);
    formData.append('action', 'reject');
    formData.append('rejectionReason', rejectionReason);

    const result = await handleJoinParentRequestAction(formData);

    if (result.success) {
      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                status: 'rejected' as const,
                rejectionReason,
              }
            : r
        )
      );
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
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
          {t('noIncomingRequests')}
        </Text>
        <Text className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
          {t('noIncomingRequestsDescription')}
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
            <TableHeader>{t('childOrg')}</TableHeader>
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
                  <div className="flex gap-2">
                    <Button
                      color="green"
                      onClick={() => handleAccept(request)}
                      disabled={isProcessing}
                    >
                      {t('accept')}
                    </Button>
                    <Button
                      color="red"
                      onClick={() => handleRejectClick(request)}
                      disabled={isProcessing}
                    >
                      {t('reject')}
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status={request.status} />
              </TableCell>
              <TableCell>{request.childOrgName}</TableCell>
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

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={isRejectDialogOpen}
        onClose={() => setIsRejectDialogOpen(false)}
      >
        <DialogTitle>{t('rejectDialogTitle')}</DialogTitle>
        <DialogDescription>
          {selectedRequest &&
            t('rejectDialogDescription', {
              childOrg: selectedRequest.childOrgName,
            })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label
              htmlFor="rejectionReason"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              {t('rejectionReasonLabel')}
            </label>
            <Textarea
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t('rejectionReasonPlaceholder')}
              rows={4}
              required
            />
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            plain
            onClick={() => setIsRejectDialogOpen(false)}
            disabled={isProcessing}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            color="red"
            onClick={handleRejectConfirm}
            disabled={isProcessing || !rejectionReason.trim()}
          >
            {isProcessing ? t('rejecting') : t('confirmReject')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
