import { randomInt } from 'node:crypto';
import type { PasswordGenerator } from '@/application/auth/PasswordGenerator';

// Ambiguous glyphs are excluded (0/O, 1/l/I): a generated password gets read
// off a screen and retyped by hand, or dictated over the phone, so a pair the
// reader can confuse costs more than the entropy it adds.
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '23456789';
const ALPHABET = LOWERCASE + UPPERCASE + DIGITS;

// 16 characters from a 57-character alphabet ≈ 93 bits of entropy, grouped
// 4-4-4-4 for legibility.
const GROUP_COUNT = 4;
const GROUP_LENGTH = 4;
const GROUP_SEPARATOR = '-';

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

export class CryptoPasswordGenerator implements PasswordGenerator {
  generate(): string {
    const length = GROUP_COUNT * GROUP_LENGTH;
    const chars = Array.from({ length }, () => pick(ALPHABET));

    // Force one character of each class at three distinct positions. A draw
    // from the full alphabet is overwhelmingly likely to contain all three
    // already, but "overwhelmingly likely" still fails occasionally, and a
    // reset that lands on a digitless password would trip composition rules
    // elsewhere (password managers, the user's own bank-style habits).
    const positions = Array.from({ length }, (_, i) => i);

    for (let i = positions.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    chars[positions[0]] = pick(LOWERCASE);
    chars[positions[1]] = pick(UPPERCASE);
    chars[positions[2]] = pick(DIGITS);

    const groups: string[] = [];

    for (let i = 0; i < length; i += GROUP_LENGTH) {
      groups.push(chars.slice(i, i + GROUP_LENGTH).join(''));
    }

    return groups.join(GROUP_SEPARATOR);
  }
}
