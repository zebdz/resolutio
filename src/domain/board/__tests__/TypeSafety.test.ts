/** Compile migrated aggregate clients: runtime assertions cannot detect erased brands.
 * One program covers board and poll entity contracts to limit compiler overhead. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('rejects mixed aggregate identities, unchecked positions and missing creation inputs', () => {
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
      path.resolve('src/domain/board/__tests__/type-contracts.ts'),
      path.resolve('src/domain/poll/__tests__/question-type-contracts.ts'),
      path.resolve('src/domain/poll/__tests__/ballot-entity-type-contracts.ts'),
    ],
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
