import { useEffect, useState } from 'react';

// Seconds left, ticking down once a second until zero. Hand the setter a new
// value to restart, e.g. from the retryAfterSeconds a request returned.
export function useCountdown(
  initialSeconds: number
): [number, (seconds: number) => void] {
  const [seconds, setSeconds] = useState(initialSeconds);

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setSeconds((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds]);

  return [seconds, setSeconds];
}
