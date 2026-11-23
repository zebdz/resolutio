import ts from 'typescript';
import path from 'node:path';
/** Join-token clients supply entropy, identity and time explicitly; persisted
 * rows cannot bypass token syntax and usage-count validation. */
import { describe, expect, it } from 'vitest';
import { JoinToken } from '../JoinToken';
import {
  JoinTokenValue,
  JoinTokenDescription,
  JoinTokenMaxUses,
} from '../JoinTokenValues';
import { OrganizationId, UserId, JoinTokenId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';

const now = Instant.parse('2026-01-01T00:00:00.000Z');
describe('JoinToken explicit inputs', () => {
  it('keeps token identities, text, usage units and lifecycle time distinct at compile time', () => {
    const program = ts.createProgram(
      [
        path.resolve(
          'src/domain/organization/__tests__/join-token.type-contracts.ts'
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
  it('releases a failed join attempt without producing a negative count', () => {
    const token = JoinToken.reconstitute({
      id: 'join-link',
      organizationId: 'org',
      createdById: 'actor',
      description: 'Lobby',
      token: 'abc234defg',
      maxUses: null,
      useCount: 1,
      createdAt: Instant.toDate(now),
      expiredAt: null,
    });
    token.releaseUse();
    expect(token.useCount).toBe(0);
    token.releaseUse();
    expect(token.useCount).toBe(0);
  });
  it('retains supplied token identity, entropy and lifecycle time', () => {
    const result = JoinToken.create(
      {
        organizationId: OrganizationId.parse('org'),
        createdById: UserId.parse('actor'),
        description: JoinTokenDescription.parse('Lobby notice'),
        token: JoinTokenValue.parse('abc234defg'),
        maxUses: JoinTokenMaxUses.parse(5),
      },
      { id: JoinTokenId.parse('join-link'), now }
    );
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.id).toBe('join-link');
    expect(result.value.token).toBe('abc234defg');
    expect(result.value.createdAt.toISOString()).toBe(now);
    result.value.expire(now);
    result.value.expiredAt!.setFullYear(1999);
    expect(result.value.expiredAt!.toISOString()).toBe(now);
  });
  it('rejects corrupted stored identity, token syntax and usage units', () => {
    const row = {
      id: 'join-link',
      organizationId: 'org',
      createdById: 'actor',
      description: 'Lobby',
      token: 'abc234defg',
      maxUses: null,
      useCount: 0,
      createdAt: Instant.toDate(now),
      expiredAt: null,
    };

    for (const invalid of [
      { id: '' },
      { token: 'bad' },
      { useCount: -1 },
      { useCount: 0.5 },
      { maxUses: Infinity },
    ]) {
      expect(() => JoinToken.reconstitute({ ...row, ...invalid })).toThrow();
    }
  });
});
