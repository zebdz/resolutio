// Countdown label for the OTP resend button. Throttle tiers run from a
// minute up to a day, so a bare number of seconds reads badly past the first
// tier; "4:59" and "1:00:00" read the way a timer does.
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(secs)}`;
  }

  return `${minutes}:${pad(secs)}`;
}
