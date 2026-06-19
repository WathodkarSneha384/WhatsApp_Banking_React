import { useEffect, useState } from 'react';

export const OTP_VALIDITY_SECONDS = 300;

export function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function useOtpCountdown(active: boolean, durationSeconds = OTP_VALIDITY_SECONDS) {
  const [secondsLeft, setSecondsLeft] = useState(durationSeconds);
  const expired = secondsLeft <= 0;

  useEffect(() => {
    if (!active) return;
    setSecondsLeft(durationSeconds);
  }, [active, durationSeconds]);

  useEffect(() => {
    if (!active || expired) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [active, expired]);

  const restart = () => setSecondsLeft(durationSeconds);

  return { secondsLeft, expired, restart, label: formatCountdown(secondsLeft) };
}
