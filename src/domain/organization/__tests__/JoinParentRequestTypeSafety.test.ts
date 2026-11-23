import ts from 'typescript';
import path from 'node:path';
import { createJoinParentRequest } from './joinParentRequestTestValues';
import { UserId } from '../../shared/EntityIds';
import { JoinParentRejectionReason } from '../JoinParentRequestValues';
import { parentRequestInstant } from './joinParentRequestTestValues';
/** Parent-request rehydration validates decision metadata as one state, preventing
 * pending/accepted/rejected combinations that cannot be produced by transitions. */
import { describe, expect, it } from 'vitest';
import { JoinParentRequest } from '../JoinParentRequest';
const row = {
  id: 'request',
  childOrgId: 'child',
  parentOrgId: 'parent',
  requestingAdminId: 'actor',
  message: 'Join our parent organization',
  status: 'pending' as const,
  handlingAdminId: null,
  handledAt: null,
  rejectionReason: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
describe('JoinParentRequest decision state', () => {
  it('keeps decision data and semantic identities distinct at compile time', () => {
    const program = ts.createProgram(
      [
        path.resolve(
          'src/domain/organization/__tests__/join-parent-request.type-contracts.ts'
        ),
      ],
      {
        strict: true,
        noEmit: true,
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        skipLibCheck: true,
        esModuleInterop: true,
        types: [],
      }
    );
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    ).toEqual([]);
  });
  it('retains supplied creation/handling time and protects decision metadata', () => {
    const result = createJoinParentRequest(
      'child',
      'parent',
      'actor',
      'Request'
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.value.id).toBe('request-fixture');
    expect(result.value.createdAt.toISOString()).toBe(parentRequestInstant);
    expect(
      result.value.accept(UserId.parse('handler'), parentRequestInstant).success
    ).toBe(true);
    expect(result.value.decision).toEqual({
      status: 'accepted',
      handlingAdminId: 'handler',
      handledAt: parentRequestInstant,
      rejectionReason: null,
    });
    result.value.handledAt!.setFullYear(1999);
    expect(result.value.handledAt!.toISOString()).toBe(parentRequestInstant);
    expect(
      result.value.accept(UserId.parse('another-handler'), parentRequestInstant)
        .success
    ).toBe(false);
    expect(result.value.handlingAdminId).toBe('handler');
  });
  it('rejects overlong rejection reasons without handling the request', () => {
    const request = JoinParentRequest.reconstitute(row);
    expect(
      request.reject(
        UserId.parse('handler'),
        'x'.repeat(501) as JoinParentRejectionReason,
        parentRequestInstant
      )
    ).toEqual({
      success: false,
      error: 'domain.joinParentRequest.rejectionReasonTooLong',
    });
    expect(request.status).toBe('pending');
  });
  it('rejects decision metadata inconsistent with persisted status', () => {
    for (const invalid of [
      { handlingAdminId: 'handler' },
      { status: 'unknown' },
      { status: 'accepted' as const },
      {
        status: 'rejected' as const,
        handlingAdminId: 'handler',
        handledAt: row.createdAt,
        rejectionReason: ' ',
      },
    ]) {
      expect(() =>
        JoinParentRequest.reconstitute({ ...row, ...invalid })
      ).toThrow();
    }
  });
});
