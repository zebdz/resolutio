export function getVersionNumber(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || 'unknown';
}

export function getVersionTimestamp(): string {
  return process.env.NEXT_PUBLIC_BUILD_ID || 'unknown';
}

export function getVersion(): string {
  return `${getVersionNumber()} (${getVersionTimestamp()})`;
}
