/** Compiles the public report/attachment client contracts alongside valid uses. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('rejects interchangeable report references and unchecked attachment units', () => {
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
    [path.resolve('src/domain/report/__tests__/type-contracts.ts')],
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
