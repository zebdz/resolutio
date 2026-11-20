/** Offline OTS v1 framing and SHA-256 file-digest binding. Follow the Python OTS
 * wire grammar and bounds. A Bitcoin height in a file is an unverified claim.
 * Chain verification belongs to an independent Bitcoin verifier. */
import { bytesToHex } from '@noble/hashes/utils.js';
import { Digest } from './SealValues';
import {
  requireSeal,
  SealDomainCodes as codes,
  sealResult,
} from './SealDomainCodes';

const invalid = codes.SEAL_INVALID_PROOF;
const magic = '004f70656e54696d657374616d7073000050726f6f6600bf89e2e884e89294';
class Reader {
  private offset = 0;
  constructor(private readonly bytes: Uint8Array) {}
  take(n: number) {
    requireSeal(n >= 0 && n <= this.bytes.length - this.offset, invalid);
    const start = this.offset;
    this.offset += n;

    return this.bytes.subarray(start, this.offset);
  }
  byte() {
    return this.take(1)[0];
  }
  uint(max: number) {
    let number = 0;

    for (
      let multiplier = 1;
      multiplier <= Math.max(1, max);
      multiplier *= 128
    ) {
      const value = this.byte();
      number += (value % 128) * multiplier;
      requireSeal(number <= max, invalid);

      if (value < 128) {
        requireSeal(multiplier === 1 || value !== 0, invalid);

        return number;
      }
    }

    requireSeal(false, invalid);
  }
  end() {
    requireSeal(this.offset === this.bytes.length, invalid);
  }
}

function attestation(stream: Reader) {
  const tag = bytesToHex(stream.take(8));
  const payload = new Reader(stream.take(stream.uint(8192)));

  if (tag === '83dfe30d2ef90c8e') {
    const uri = payload.take(payload.uint(1000));
    requireSeal(
      uri.length > 0 &&
        /^[A-Za-z0-9._/:\-]+$/.test(new TextDecoder().decode(uri)),
      invalid
    );
    payload.end();

    return 'pending';
  }

  if (
    ['0588960d73d71901', '06869a0d73d71b45', '30fe8087b5c7ead7'].includes(tag)
  ) {
    payload.uint(0xffffffff);
    payload.end();
  }

  return tag === '0588960d73d71901' ? 'bitcoin' : 'other';
}

function operationSize(tag: number, size: number, reader: Reader) {
  switch (tag) {
    case 0xf0:

    case 0xf1: {
      const length = reader.uint(4096);
      requireSeal(length > 0, invalid);
      reader.take(length);

      return size + length;
    }

    case 0xf2:
      return size;
    case 0xf3:
      return size * 2;
    case 2:
    case 3:
      return 20;
    case 8:
    case 0x67:
      return 32;
    default:
      requireSeal(false, invalid);
  }
}

export function inspectTimestamp(bytes: Uint8Array, root: Digest) {
  return sealResult(() => {
    if (
      bytes.length === 74 &&
      new TextDecoder().decode(bytes) === 'SIMULATED:' + root
    ) {
      return 'simulated' as const;
    }

    const reader = new Reader(bytes);
    requireSeal(
      bytesToHex(reader.take(31)) === magic &&
        reader.uint(1) === 1 &&
        reader.byte() === 8,
      invalid
    );
    requireSeal(
      bytesToHex(reader.take(32)) === root,
      codes.SEAL_PROOF_DIGEST_MISMATCH
    );
    const found = new Set<string>();

    function tree(depth: number, size: number) {
      requireSeal(depth <= 256 && size <= 4096, invalid);
      let more: boolean;

      do {
        let tag = reader.byte();
        more = tag === 255;

        if (more) {
          tag = reader.byte();
        }

        if (tag === 0) {
          found.add(attestation(reader));
        } else {
          tree(depth + 1, operationSize(tag, size, reader));
        }
      } while (more);
    }

    tree(0, 32);
    reader.end();
    requireSeal(found.has('bitcoin') || found.has('pending'), invalid);

    return found.has('bitcoin')
      ? ('bitcoinAttestationUnverified' as const)
      : ('pending' as const);
  });
}
