/** Property numeric values reject invalid inputs without changing arithmetic
 * or rounding; compile contracts keep size and ownership fractions distinct. */
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import ts from 'typescript';
import {
  AssetSize,
  OwnershipShare,
  OwnershipPercentage,
  AssetName,
  ExternalOwnerLabel,
} from '../PropertyValues';

describe('property values', () => {
  it('preserves ownership percentages from zero through one hundred without rounding', () => {
    for (const value of [0, 12.3456789, 100]) {
      expect(OwnershipPercentage.parse(value)).toBe(value);
    }

    for (const value of [-0.01, 100.01, NaN, Infinity, '50', null]) {
      expect(OwnershipPercentage.safeParse(value).success).toBe(false);
    }
  });
  it('requires nonempty asset names and external-owner labels', () => {
    expect(AssetName.parse(' Unit ')).toBe('Unit');
    expect(ExternalOwnerLabel.parse(' Owner ')).toBe('Owner');

    for (const schema of [AssetName, ExternalOwnerLabel]) {
      expect(schema.safeParse('  ').success).toBe(false);
    }
  });
  it('retains positive finite sizes without rounding and rejects invalid sizes', () => {
    const size = 123.456789123;
    expect(AssetSize.parse(size)).toBe(size);

    for (const value of [0, -1, NaN, Infinity, -Infinity, '1', null]) {
      expect(AssetSize.safeParse(value).success).toBe(false);
    }
  });

  it('preserves shares from zero through one without rounding and rejects invalid fractions', () => {
    for (const value of [0, 0.123456789, 1]) {
      expect(OwnershipShare.parse(value)).toBe(value);
    }

    for (const value of [-0.01, 1.01, NaN, Infinity, -Infinity, '0.5', null]) {
      expect(OwnershipShare.safeParse(value).success).toBe(false);
    }

    expect(AssetSize.parse(12.5) * OwnershipShare.parse(0.25)).toBe(3.125);
  });

  it('rejects unchecked and interchangeable property units at compile time', () => {
    const program = ts.createProgram(
      [
        path.resolve(
          'src/domain/organization/__tests__/property-values.type-contracts.ts'
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
        .map(
          (diagnostic) =>
            `${diagnostic.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
        )
    ).toEqual([]);
  });
});
