'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Divider } from '@/app/components/catalyst/divider';
import { Textarea } from '@/app/components/catalyst/textarea';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { handleJoinRequestAction } from '@/web/actions/organization';

interface PendingRequest {
  organizationId: string;
  organizationName: string;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  };
  requestedAt: Date;
}

interface PendingRequestsListProps {
  requests: PendingRequest[];
}

export function PendingRequestsList({
  requests: initialRequests,
}: PendingRequestsListProps) {
  const t = useTranslations('organization.pendingRequests');
  const tCommon = useTranslations('common');
  const [requests, setRequests] = useState(initialRequests);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccept = async (request: PendingRequest) => {
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('organizationId', request.organizationId);
    formData.append('requesterId', request.requester.id);
    formData.append('action', 'accept');

    const result = await handleJoinRequestAction(formData);

    if (result.success) {
      // Remove the accepted request from the list
      setRequests((prev) =>
        prev.filter(
          (r) =>
            !(
              r.organizationId === request.organizationId &&
              r.requester.id === request.requester.id
            )
        )
      );
    } else {
      setError(result.error);
    }

    setIsProcessing(false);
  };

  const handleRejectClick = (request: PendingRequest) => {
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
    formData.append('organizationId', selectedRequest.organizationId);
    formData.append('requesterId', selectedRequest.requester.id);
    formData.append('action', 'reject');
    if (rejectionReason) {
      formData.append('rejectionReason', rejectionReason);
    }

    const result = await handleJoinRequestAction(formData);

    if (result.success) {
      // Remove the rejected request from the list
      setRequests((prev) =>
        prev.filter(
          (r) =>
            !(
              r.organizationId === selectedRequest.organizationId &&
              r.requester.id === selectedRequest.requester.id
            )
        )
      );
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
          {t('noPending')}
        </Text>
        <Text className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
          {t('noPendingDescription')}
        </Text>
      </div>
    );
  }

  // Group requests by organization
  const requestsByOrg = requests.reduce(
    (acc, request) => {
      const orgId = request.organizationId;
      if (!acc[orgId]) {
        acc[orgId] = {
          organizationId: request.organizationId,
          organizationName: request.organizationName,
          requests: [],
        };
      }
      acc[orgId].requests.push(request);

      return acc;
    },
    {} as Record<
      string,
      {
        organizationId: string;
        organizationName: string;
        requests: PendingRequest[];
      }
    >
  );

  return (
    <>
      <div className="space-y-8">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
            <Text className="text-red-800 dark:text-red-200">{error}</Text>
          </div>
        )}

        {Object.values(requestsByOrg).map(
          ({ organizationId, organizationName, requests: orgRequests }) => (
            <div key={organizationId} className="space-y-4">
              <div>
                <Heading level={2} className="text-xl font-semibold">
                  {organizationName}
                </Heading>
              </div>

              <div className="space-y-4">
                {orgRequests.map((request, index) => (
                  <div
                    key={`${request.organizationId}-${request.requester.id}-${index}`}
                    className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <Heading level={3} className="text-lg font-semibold">
                            {request.requester.firstName}{' '}
                            {request.requester.lastName}
                          </Heading>
                          <Badge color="yellow">{t('statusPending')}</Badge>
                        </div>
                        <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                          {request.requester.phoneNumber}
                        </Text>
                        <Text className="text-xs text-zinc-500 dark:text-zinc-500">
                          {t('requestedOn')}{' '}
                          {request.requestedAt.toLocaleDateString()}
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

              <Divider />
            </div>
          )
        )}
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
              name: `${selectedRequest.requester.firstName} ${selectedRequest.requester.lastName}`,
              organization: selectedRequest.organizationName,
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
            disabled={isProcessing}
          >
            {isProcessing ? t('rejecting') : t('confirmReject')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
