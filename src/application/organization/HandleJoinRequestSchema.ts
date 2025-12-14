import { z } from 'zod';

export const HandleJoinRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  requesterId: z.string().min(1, 'Requester ID is required'),
  adminId: z.string().min(1, 'Admin ID is required'),
  action: z.enum(['accept', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

export type HandleJoinRequestInput = z.infer<typeof HandleJoinRequestSchema>;
