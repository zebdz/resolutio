/** Compile client contracts: runtime tests cannot detect interchangeable domain types.
 * Expected compiler failures must remain failures as the public API evolves. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import path from 'node:path';

it('rejects mixed domain values and impossible anchor states at compile time', () => {
  const program = ts.createProgram(
    [path.resolve('src/domain/seal/__tests__/type-contracts.ts')],
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
  const diagnostics = ts.getPreEmitDiagnostics(program);
  expect(
    diagnostics.map(
      (d) =>
        `${d.file?.fileName ?? ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`
    )
  ).toEqual([]);
});
