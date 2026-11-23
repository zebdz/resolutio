/** Compile the poll API's negative client contracts alongside its valid usages.
 * Runtime tests alone cannot detect primitive aliases or swapped identifier types. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('rejects unchecked and interchangeable domain values at compile time', () => {
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
      'type-contracts.ts',
      'question-type-contracts.ts',
      'ballot-entity-type-contracts.ts',
      'result-type-contracts.ts',
      'application-type-contracts.ts',
    ].map((file) => path.resolve('src/domain/poll/__tests__', file)),
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
        (d) =>
          `${d.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`
      )
  ).toEqual([]);
});
