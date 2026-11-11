/** Compile public provider contracts; runtime tests cannot detect unit/alternative erasure. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('keeps SMS transport units and cost-configuration alternatives distinct', () => {
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
        'src/infrastructure/auth/__tests__/sms-ru-type-contracts.ts'
      ),
    ],
    { ...options, noEmit: true, incremental: false, types: ['node'] }
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
