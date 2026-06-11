"use client";

import { cn } from "@/lib/cn";

export function AmountInput({
  value,
  onChange,
  balance,
  placeholder = "0.00",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  /** ui-units balance for MAX/HALF chips */
  balance?: number | null;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <input
        value={value}
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (/^[0-9]*\.?[0-9]*$/.test(v)) onChange(v);
        }}
        className="tnum w-full min-w-0 bg-transparent font-mono text-lg font-bold text-fg outline-none placeholder:text-dim"
      />
      {balance != null && balance > 0 && (
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onChange(String(balance / 2))}
            className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
          >
            HALF
          </button>
          <button
            onClick={() => onChange(String(balance))}
            className="rounded border border-line px-1.5 py-0.5 font-mono text-[9px] text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
          >
            MAX
          </button>
        </div>
      )}
    </div>
  );
}
