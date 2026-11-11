/** Compile public identity/time clients because runtime tests cannot detect
 * interchangeable brands, missing creation inputs or weakened readonly fields. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('rejects mixed identities, raw times and incomplete creation values', () => {
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
    [path.resolve('src/domain/shared/__tests__/identity-type-contracts.ts')],
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
