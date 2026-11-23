/** Organization value contracts preserve historical names while validating new
 * names, and keep creation/time/hierarchy and pagination meanings explicit. */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';
import {
  OrganizationName,
  NewOrganizationName,
  OrganizationDescription,
  MemberRemovalReason,
} from '../OrganizationValues';
import { OrganizationId, UserId } from '../../shared/EntityIds';
import { Organization } from '../Organization';
import { Instant } from '../../shared/Instant';

describe('organization values', () => {
  it('distinguishes historical names from new names without accepting blank values', () => {
    expect(OrganizationName.parse('Legacy <name>')).toBe('Legacy <name>');
    expect(NewOrganizationName.safeParse('Legacy <name>').success).toBe(false);
    expect(NewOrganizationName.parse('  Товарищество «Дом»  ')).toBe(
      'Товарищество «Дом»'
    );

    for (const schema of [
      OrganizationName,
      NewOrganizationName,
      OrganizationDescription,
      MemberRemovalReason,
    ]) {
      expect(schema.safeParse('  ').success).toBe(false);
    }
  });
  it('preserves explicit creation/archive times against mutation of Date projections', () => {
    const createdAt = Instant.parse('2026-01-01T00:00:00.000Z');
    const archivedAt = Instant.parse('2026-02-01T00:00:00.000Z');
    const result = Organization.create(
      NewOrganizationName.parse('Org'),
      OrganizationDescription.parse('Description'),
      UserId.parse('actor'),
      { kind: 'root', allowMultiTreeMembership: false },
      { id: OrganizationId.parse('org'), now: createdAt }
    );

    if (!result.success) {
      throw new Error(result.error);
    }

    result.value.createdAt.setFullYear(2000);
    result.value.archive(archivedAt);
    result.value.archivedAt!.setFullYear(2000);
    expect(result.value.createdAt.toISOString()).toBe(createdAt);
    expect(result.value.archivedAt!.toISOString()).toBe(archivedAt);
  });
  it('rejects interchangeable identifiers, unchecked names and impossible hierarchy states at compile time', () => {
    const config = ts.readConfigFile(
      path.resolve('tsconfig.json'),
      ts.sys.readFile
    );
    const { options } = ts.parseJsonConfigFileContent(
      config.config,
      ts.sys,
      path.resolve()
    );
    const program = ts.createProgram(
      [
        path.resolve(
          'src/domain/organization/__tests__/organization.type-contracts.ts'
        ),
        path.resolve(
          'src/domain/organization/__tests__/membership-type-contracts.ts'
        ),
        path.resolve(
          'src/application/organization/__tests__/application-type-contracts.ts'
        ),
        path.resolve(
          'src/application/invitation/__tests__/application-type-contracts.ts'
        ),
      ],
      {
        ...options,
        noEmit: true,
        incremental: false,
        types: ['node'],
      }
    );
    expect(
      ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    ).toEqual([]);
  });
});
