/**
 * Render an address safe to show in a notice: enough for the owner to
 * recognize, not enough for a reader to reconstruct.
 */
export function maskEmail(address: string): string {
  const at = address.indexOf('@');

  if (at <= 0) {
    return '•••';
  }

  const local = address.slice(0, at);
  const domain = address.slice(at + 1);

  if (local.length < 2) {
    return `•••@${domain}`;
  }

  return `${local[0]}•••@${domain}`;
}
