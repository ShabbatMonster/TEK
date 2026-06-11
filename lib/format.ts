export function fmtUsd(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  if (n > 0) return `$${n.toExponential(2)}`;
  return "$0";
}

export function fmtNum(n: number | null | undefined, digits = 2): string {
  if (n == null || !isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function fmtSol(lamports: number, digits = 4): string {
  return (lamports / 1e9).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function shortAddr(addr: string, chars = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, chars)}…${addr.slice(-chars)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/** ui amount string -> raw bigint string for the given decimals */
export function uiToRaw(amount: string, decimals: number): string {
  const [int = "0", frac = ""] = amount.replace(/,/g, "").split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const raw = `${int}${fracPadded}`.replace(/^0+(?=\d)/, "");
  return raw || "0";
}

export function rawToUi(raw: string | number | bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}
