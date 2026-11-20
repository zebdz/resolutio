/** Standalone offline verifier. This adapter reads local files and reports the shared
 * verifier's checks. The packaged entry point runs using Node alone. */
import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  EvidenceFiles,
  verifyEvidence,
} from '../src/domain/seal/VerifyEvidence';
import { success, failure, Result } from '../src/domain/shared/Result';

const help =
  'Usage: node verify-seal.mjs [--manifest manifest.json] [--bundle bundle.json] [--receipt receipt.json | --code-file code.txt] [--sections sections.json] [--poll poll.json] [--proof manifest.json.ots]';
const textKeys = [
  'manifest',
  'bundle',
  'receipt',
  'sections',
  'poll',
  'code-file',
] as const;
const fileOption = { type: 'string' } as const;

function argumentsFor(args: string[]) {
  try {
    const options = parseArgs({
      args,
      allowPositionals: false,
      strict: true,
      tokens: true,
      options: {
        manifest: fileOption,
        bundle: fileOption,
        receipt: fileOption,
        sections: fileOption,
        poll: fileOption,
        proof: fileOption,
        'code-file': fileOption,
        help: { type: 'boolean' },
      },
    });
    const seen = new Set<string>();

    for (const token of options.tokens) {
      if (token.kind === 'option') {
        if (seen.has(token.name)) {
          return failure('Repeated option: ' + token.name);
        }

        seen.add(token.name);
      }
    }

    if (
      !args.length ||
      (options.values.receipt !== undefined &&
        options.values['code-file'] !== undefined)
    ) {
      return failure(help);
    }

    return success(options.values);
  } catch {
    return failure(help);
  }
}

type FileOptions = Partial<Record<(typeof textKeys)[number] | 'proof', string>>;

async function loadFiles(
  options: FileOptions
): Promise<Result<EvidenceFiles, string>> {
  const files: EvidenceFiles = {};

  for (const key of [...textKeys, 'proof'] as const) {
    const path = options[key];

    if (path === undefined) {
      continue;
    }

    try {
      const bytes = await readFile(path);

      if (key === 'proof') {
        files.proof = bytes;
      } else {
        const value = new TextDecoder('utf-8', {
          fatal: true,
          ignoreBOM: true,
        }).decode(bytes);

        if (key === 'code-file') {
          files.code = value.trimEnd();
        } else {
          files[key] = value;
        }
      }
    } catch {
      return failure('Cannot read ' + key + ' file');
    }
  }

  return success(files);
}

async function main() {
  const parsed = argumentsFor(process.argv.slice(2));

  if (!parsed.success) {
    console.error(parsed.error);

    return 2;
  }

  if (parsed.value.help) {
    console.log(help);

    return 0;
  }

  const files = await loadFiles(parsed.value);

  if (!files.success) {
    console.error(files.error);

    return 2;
  }

  const result = verifyEvidence(files.value);

  if (!result.success) {
    console.error(result.error);

    return 1;
  }

  console.log(JSON.stringify(result.value, null, 2));

  return 0;
}

process.exitCode = await main();
