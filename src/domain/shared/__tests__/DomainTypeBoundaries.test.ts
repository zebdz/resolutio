/** Architecture regressions distinguish retained domain contracts from reviewed raw/wire DTOs.
 * The compiler resolves aliases; separate constructor/ID tests prove runtime validation and type separation. */
import { expect, it } from 'vitest';
import ts from 'typescript';
import { resolve } from 'node:path';
import { readdirSync } from 'node:fs';
import { findDomainTypeLeaks } from '../../../../scripts/domain-type-audit';

function virtualProgram(source: string) {
  const file = '/virtual-domain/Example.ts';
  const options = {
    target: ts.ScriptTarget.ES2022,
    strict: true,
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const readSource = host.getSourceFile.bind(host);
  host.getSourceFile = (path, languageVersion, ...rest) =>
    path === file
      ? ts.createSourceFile(path, source, languageVersion, true)
      : readSource(path, languageVersion, ...rest);

  return ts.createProgram([file], options, host);
}

it('detects unbranded aliases in retained state and repository parameters', () => {
  const program = virtualProgram(`
    type UserId = string;
    interface AccountState { userId: UserId; voteCount: number; finishedAt: Date | null }
    interface AccountRepository { findById(userId: UserId): Promise<void> }
  `);
  expect(
    findDomainTypeLeaks(program, '/virtual-domain').map((leak) => leak.field)
  ).toEqual(['userId', 'voteCount', 'finishedAt', 'userId']);
});
it('accepts distinct branded units, closed alternatives and ordinary display text', () => {
  const program = virtualProgram(`
    type UserId = string & { readonly brand: 'UserId' };
    type VoteCount = number & { readonly brand: 'VoteCount' };
    type Instant = string & { readonly brand: 'Instant' };
    interface AccountState { userId: UserId; voteCount: VoteCount; finishedAt: Instant | null; state: 'ready' | 'finished'; displayName: string }
    interface AccountRepository { findById(userId: UserId): Promise<void> }
  `);
  expect(findDomainTypeLeaks(program, '/virtual-domain')).toEqual([]);
});
it('detects aliases in readonly collections and private constructor properties', () => {
  const program = virtualProgram(`
    type UserId = string;
    interface Selection { userIds: readonly UserId[] }
    class Account { constructor(private readonly userId: UserId) {} }
  `);
  expect(
    findDomainTypeLeaks(program, '/virtual-domain').map((leak) => leak.field)
  ).toEqual(['userIds', 'userId']);
});
it('keeps current retained domain state and ports free of unreviewed primitive contracts', () => {
  const domainRoot = resolve('src/domain');

  function files(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (entry.name === '__tests__') {
        return [];
      }

      const path = resolve(dir, entry.name);

      return entry.isDirectory()
        ? files(path)
        : entry.name.endsWith('.ts')
          ? [path]
          : [];
    });
  }

  const config = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    process.cwd()
  );
  const program = ts.createProgram(files(domainRoot), parsed.options);
  expect(findDomainTypeLeaks(program, domainRoot)).toEqual([]);
}, 15000);
