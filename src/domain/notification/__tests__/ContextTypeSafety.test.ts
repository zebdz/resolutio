/** Runtime tests cannot prove brands or discriminated alternatives reject invalid clients. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';
it('rejects invalid notification/invitation/analysis/configuration client contracts', () => {
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
        'src/domain/notification/__tests__/context-type-contracts.ts'
      ),
    ],
    { ...options, noEmit: true, incremental: false, types: ['node'] }
  );
  expect(
    ts
      .getPreEmitDiagnostics(program)
      .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
  ).toEqual([]);
});
