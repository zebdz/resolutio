'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Button } from '@/src/web/components/catalyst/button';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Divider } from '@/src/web/components/catalyst/divider';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { Select } from '@/src/web/components/catalyst/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/web/components/catalyst/table';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import {
  handleJoinRequestAction,
  getPendingRequestsAction,
} from '@/web/actions/organization';

interface PendingRequest {
  organizationId: string;
  organizationName: string;
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  requestedAt: Date;
}

interface PendingRequestsListProps {
  requests: PendingRequest[];
  totalCount: number;
  defaultPageSize: number;
}

const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

export function PendingRequestsList({
  requests: initialRequests,
  totalCount: initialTotalCount,
  defaultPageSize,
}: PendingRequestsListProps) {
  const t = useTranslations('organization.pendingRequests');
  const tCommon = useTranslations('common');
  const tPagination = useTranslations('common.pagination');
  const [requests, setRequests] = useState(initialRequests);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const fetchPage = useCallback(async (page: number, size: number) => {
    setIsLoading(true);
    const result = await getPendingRequestsAction(page, size);

    if (result.success) {
      setRequests(result.data.requests);
      setTotalCount(result.data.totalCount);
    }

    setIsLoading(false);
  }, []);

  const handlePageChange = useCallback(
    async (page: number) => {
      setCurrentPage(page);
      await fetchPage(page, pageSize);
    },
    [fetchPage, pageSize]
  );

  const handlePageSizeChange = useCallback(
    async (newSize: number) => {
      setPageSize(newSize);
      setCurrentPage(1);
      await fetchPage(1, newSize);
    },
    [fetchPage]
  );

  const handleAccept = async (request: PendingRequest) => {
    setIsProcessing(true);
    setError(null);

    const formData = new FormData();
    formData.append('organizationId', request.organizationId);
    formData.append('requesterId', request.requester.id);
    formData.append('action', 'accept');

    const result = await handleJoinRequestAction(formData);

    if (result.success) {
      await fetchPage(currentPage, pageSize);
    } else {
      setError(result.error);
    }

    setIsProcessing(false);
  };

  const handleRejectClick = (request: PendingRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setDialogError(null);
    setIsRejectDialogOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequest) {
      return;
    }

    setIsProcessing(true);
    setDialogError(null);
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
      setIsRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectionReason('');
      await fetchPage(currentPage, pageSize);
    } else if (result.fieldErrors?.rejectionReason) {
      setDialogError(result.fieldErrors.rejectionReason[0]);
    } else {
      setError(result.error);
    }

    setIsProcessing(false);
  };

  if (requests.length === 0 && totalCount === 0) {
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

  // Group requests by organization (for mobile card view)
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

  const actionButtons = (request: PendingRequest) => (
    <div className="flex gap-2">
      <Button
        color="green"
        onClick={() => handleAccept(request)}
        disabled={isProcessing || isLoading}
      >
        {t('accept')}
      </Button>
      <Button
        color="red"
        onClick={() => handleRejectClick(request)}
        disabled={isProcessing || isLoading}
      >
        {t('reject')}
      </Button>
    </div>
  );

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  const paginationControls = (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      <div className="flex items-center gap-2">
        <Text className="text-sm">{tPagination('rowsPerPage')}</Text>
        <Select
          value={String(pageSize)}
          onChange={(e) => handlePageSizeChange(Number(e.target.value))}
          className="w-20"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </div>

      <Text className="text-sm text-zinc-600 dark:text-zinc-400">
        {tPagination('showing', {
          from: String(from),
          to: String(to),
          total: String(totalCount),
        })}
      </Text>

      <div className="flex items-center gap-2">
        <Button
          plain
          disabled={currentPage <= 1 || isLoading}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          {tPagination('previous')}
        </Button>
        <Text className="text-sm">
          {tPagination('page', {
            page: String(currentPage),
            totalPages: String(totalPages),
          })}
        </Text>
        <Button
          plain
          disabled={currentPage >= totalPages || isLoading}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          {tPagination('next')}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{error}</Text>
        </div>
      )}

      {/* Desktop table view */}
      <div className="hidden sm:block">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>{tCommon('actions')}</TableHeader>
              <TableHeader>{t('columnStatus')}</TableHeader>
              <TableHeader>{t('columnOrganization')}</TableHeader>
              <TableHeader>{t('columnRequester')}</TableHeader>
              <TableHeader className="hidden md:table-cell">
                {t('columnRequestedOn')}
              </TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((request, index) => (
              <TableRow
                key={`${request.organizationId}-${request.requester.id}-${index}`}
              >
                <TableCell>{actionButtons(request)}</TableCell>
                <TableCell>
                  <Badge color="yellow">{t('statusPending')}</Badge>
                </TableCell>
                <TableCell>{request.organizationName}</TableCell>
                <TableCell>
                  {[
                    request.requester.lastName,
                    request.requester.middleName,
                    request.requester.firstName,
                  ]
                    .filter(Boolean)
                    .join(' ')}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  {new Date(request.requestedAt).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile card view */}
      <div className="space-y-8 sm:hidden">
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
                            {[
                              request.requester.lastName,
                              request.requester.middleName,
                              request.requester.firstName,
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          </Heading>
                          <Badge color="yellow">{t('statusPending')}</Badge>
                        </div>
                        <Text className="text-xs text-zinc-500 dark:text-zinc-500">
                          {t('requestedOn')}{' '}
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </Text>
                      </div>

                      {actionButtons(request)}
                    </div>
                  </div>
                ))}
              </div>

              <Divider />
            </div>
          )
        )}
      </div>

      {/* Pagination */}
      <div className="mt-6">{paginationControls}</div>

      {/* Reject Confirmation Dialog */}
      <Dialog
        open={isRejectDialogOpen}
        onClose={() => setIsRejectDialogOpen(false)}
      >
        <DialogTitle>{t('rejectDialogTitle')}</DialogTitle>
        <DialogDescription>
          {selectedRequest &&
            t('rejectDialogDescription', {
              name: [
                selectedRequest.requester.lastName,
                selectedRequest.requester.middleName,
                selectedRequest.requester.firstName,
              ]
                .filter(Boolean)
                .join(' '),
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
              invalid={!!dialogError}
              onChange={(e) => {
                setRejectionReason(e.target.value);
                setDialogError(null);
              }}
              placeholder={t('rejectionReasonPlaceholder')}
              rows={4}
            />
            {dialogError && (
              <p className="text-sm text-red-600">{dialogError}</p>
            )}
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
