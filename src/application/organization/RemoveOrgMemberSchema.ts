import { z } from 'zod';

// organizationId and targetUserId are opaque identifiers whose existence the
// use case verifies by lookup. They are NOT format-constrained here: org ids in
// this app are a mix of UUIDs (legacy) and cuids, and validating them as cuid
// silently rejected every UUID-id organization. Require presence only.
export const RemoveOrgMemberSchema = z.object({
  organizationId: z.string().min(1, 'Invalid organization ID'),
  targetUserId: z.string().min(1, 'Invalid user ID'),
  reason: z.string().trim().min(1).max(500),
});

export type RemoveOrgMemberActionInput = z.infer<typeof RemoveOrgMemberSchema>;
