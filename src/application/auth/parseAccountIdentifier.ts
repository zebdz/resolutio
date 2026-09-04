import { EmailAddress } from '@/domain/user/EmailAddress';
import { PhoneNumber } from '@/domain/user/PhoneNumber';

export type AccountIdentifier =
  | { kind: 'email'; email: EmailAddress }
  | { kind: 'phone'; phone: PhoneNumber };

/**
 * Read whichever identifier the user typed on the forgot-password screen.
 * Returns null when it is neither — a purely syntactic verdict that reveals
 * nothing about which accounts exist.
 */
export function parseAccountIdentifier(raw: string): AccountIdentifier | null {
  const trimmed = (raw ?? '').trim();

  if (trimmed.length === 0) {
    return null;
  }

  if (trimmed.includes('@')) {
    try {
      return { kind: 'email', email: EmailAddress.create(trimmed) };
    } catch {
      return null;
    }
  }

  // People type phone numbers with spaces, brackets and dashes; PhoneNumber
  // only accepts E.164, so strip the decoration before handing it over.
  const digits = trimmed.replace(/[^\d+]/g, '');
  const normalized = digits.startsWith('+') ? digits : `+${digits}`;

  try {
    return { kind: 'phone', phone: PhoneNumber.create(normalized) };
  } catch {
    return null;
  }
}
