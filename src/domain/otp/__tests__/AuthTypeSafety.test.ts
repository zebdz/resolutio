/** Compile public authentication clients to guard opaque credentials and time units. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('rejects raw and mismatched authentication values', () => {
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
    [path.resolve('src/domain/otp/__tests__/auth-type-contracts.ts')],
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
      .map(
        (diagnostic) =>
          `${diagnostic.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')}`
      )
  ).toEqual([]);
});
