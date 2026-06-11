"use client";

import { useEffect, useRef, useState } from "react";

const CIPHER = "▓▒░!<>-_\\/[]{}—=+*^?#01";

/** Text that resolves through cipher characters. ShadowSwap's signature. */
export function ScrambleText({
  text,
  speed = 28,
  className,
}: {
  text: string;
  speed?: number;
  className?: string;
}) {
  const [out, setOut] = useState(text);
  const frame = useRef(0);

  useEffect(() => {
    let raf: number;
    let last = 0;
    frame.current = 0;
    const total = text.length * 2.5;

    function tick(ts: number) {
      if (ts - last > speed) {
        last = ts;
        frame.current++;
        const progress = frame.current / total;
        const resolved = Math.floor(progress * text.length);
        let s = "";
        for (let i = 0; i < text.length; i++) {
          if (i < resolved || text[i] === " ") s += text[i];
          else s += CIPHER[Math.floor(Math.random() * CIPHER.length)];
        }
        setOut(s);
        if (resolved >= text.length) return;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, speed]);

  return <span className={className}>{out}</span>;
}

/** Redacted-until-hover value. */
export function Redacted({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <span
      className={className}
      onMouseEnter={() => setShown(true)}
      onMouseLeave={() => setShown(false)}
    >
      {shown ? value : "▓".repeat(Math.min(value.length, 10))}
    </span>
  );
}
