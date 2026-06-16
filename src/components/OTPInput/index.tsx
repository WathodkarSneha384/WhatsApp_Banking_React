import { useState, useRef } from 'react';

interface OTPInputProps {
  onComplete: (otp: string) => void;
  length?: number;
}

export default function OTPInput({ onComplete, length = 6 }: OTPInputProps) {
  const [digits, setDigits] = useState<string[]>(Array(length).fill(''));
  const refs = Array.from({ length }, () => useRef<HTMLInputElement>(null));

  const handle = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits];
    next[i] = val.slice(-1);
    setDigits(next);
    if (val && i < length - 1) refs[i + 1].current?.focus();
    if (next.every(d => d)) onComplete(next.join(''));
  };

  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs[i - 1].current?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    e.preventDefault();
    const next = [...digits];
    pasted.split('').forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    const focusIdx = Math.min(pasted.length, length - 1);
    refs[focusIdx].current?.focus();
    if (pasted.length === length) onComplete(pasted);
  };

  return (
    <div className="otp-container">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={refs[i]}
          className="otp-input"
          maxLength={1}
          value={d}
          inputMode="numeric"
          onChange={e => handle(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
        />
      ))}
    </div>
  );
}
