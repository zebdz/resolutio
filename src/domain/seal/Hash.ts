/** Shared synchronous hashing for Node, CLI and browser verification; no randomness or I/O. */
import { sha256 } from '@noble/hashes/sha2.js';
import { hmac } from '@noble/hashes/hmac.js';
import {
  bytesToHex,
  hexToBytes,
  concatBytes,
  utf8ToBytes,
} from '@noble/hashes/utils.js';
import { requireSeal } from './SealDomainCodes';
import { Digest, ReceiptSecret } from './SealValues';

export function assertHash(value: unknown): asserts value is Digest {
  requireSeal(Digest.schema.safeParse(value).success);
}

export function hashBytes(...parts: Uint8Array[]): Digest {
  return Digest.parse(bytesToHex(sha256(concatBytes(...parts))));
}

export function hashText(value: string): Digest {
  return hashBytes(utf8ToBytes(value));
}

export function hmacHex(secret: ReceiptSecret, message: string): string {
  return bytesToHex(hmac(sha256, hexToBytes(secret), utf8ToBytes(message)));
}

export function hashNode(left: Digest, right: Digest): Digest {
  assertHash(left);
  assertHash(right);

  return hashBytes(new Uint8Array([1]), hexToBytes(left), hexToBytes(right));
}
