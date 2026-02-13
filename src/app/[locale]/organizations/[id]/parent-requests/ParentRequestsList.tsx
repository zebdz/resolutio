'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Textarea } from '@/app/components/catalyst/textarea';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { handleJoinParentRequestAction } from '@/web/actions/joinParentRequest';

interface ParentRequest {
  id: string;
  childOrgId: string;
  childOrgName: string;
  requestingAdminName: string;
  message: string;
  createdAt: Date;
}

interface ParentRequestsListProps {
  requests: ParentRequest[];
}

export function ParentRequestsList({
  requests: initialRequests,
}: ParentRequestsListProps) {
  const t = useTranslations('organization.joinParent');
  const tCommon = useTranslations('common');
  const [requests, setRequests] = useState(initialRequests);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ParentRequest | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (request: ParentRequest) => {
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('requestId', request.id);
    formData.append('action', 'accept');

    const result = await handleJoinParentRequestAction(formData);

    if (result.success) {
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } else {
      setError(result.error);
    }

    setIsProcessing(false);
  };

  const handleRejectClick = (request: ParentRequest) => {
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
      setRequests((prev) => prev.filter((r) => r.id !== selectedRequest.id));
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
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
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <Text className="text-red-800 dark:text-red-200">{error}</Text>
          </div>
        )}

        {requests.map((request) => (
          <div
            key={request.id}
            className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <Heading level={3} className="text-lg font-semibold">
                    {request.childOrgName}
                  </Heading>
                  <Badge color="yellow">
                    {t('accept').replace('Accept', 'Pending')}
                  </Badge>
                </div>
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('requestingAdmin')}: {request.requestingAdminName}
                </Text>
                <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                  {t('requestMessage')}: {request.message}
                </Text>
                <Text className="text-xs text-zinc-500 dark:text-zinc-500">
                  {t('requestedAt')}{' '}
                  {new Date(request.createdAt).toLocaleDateString()}
                </Text>
              </div>

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
            </div>
          </div>
        ))}
      </div>

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
