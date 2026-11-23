/** Compile public user clients so raw or mismatched values cannot bypass the domain. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('requires typed identity, profile, credentials and explicit time', () => {
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
    [path.resolve('src/domain/user/__tests__/user-type-contracts.ts')],
    { ...options, noEmit: true, incremental: false, types: ['node'] }
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
