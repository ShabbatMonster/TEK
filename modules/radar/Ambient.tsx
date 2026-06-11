"use client";

import { useEffect, useMemo, useRef } from "react";
import { useKernelStore } from "@/kernel/store";
import { fmtPct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pickBestPairs, type DexPair } from "./lib";
import { useRadarBoosts, useRadarPairs } from "./queries";
import { useRadarStore } from "./store";

const SWEEP_MS = 4000;
const UP = "#2fd97b";
const DOWN = "#ff4d5e";
const RING = "rgba(57, 255, 136, 0.16)";
const ACCENT = "#39ff88";

/** deterministic 32-bit hash -> [0, 1) for blip angle */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

interface Blip {
  angle: number; // radians
  rFrac: number; // 0 center .. 1 edge (newer pairs closer to center)
  size: number;
  color: string;
}

function toBlips(pairs: DexPair[]): Blip[] {
  const now = Date.now();
  return pairs.map((p) => {
    const ageH = p.pairCreatedAt
      ? Math.max(0, (now - p.pairCreatedAt) / 3_600_000)
      : 24 * 30;
    // log scale: brand new ≈ 0.18R, one week+ ≈ 0.95R
    const rFrac = 0.18 + 0.77 * Math.min(1, Math.log1p(ageH) / Math.log1p(168));
    const mc = p.marketCap ?? p.fdv ?? 0;
    const size = 1.4 + Math.min(4, Math.max(0, Math.log10(Math.max(1, mc)) - 4)) * 0.7;
    return {
      angle: hash01(p.baseToken.address) * Math.PI * 2,
      rFrac,
      size,
      color: (p.priceChange?.h24 ?? 0) >= 0 ? UP : DOWN,
    };
  });
}

export default function RadarAmbient() {
  const focus = useKernelStore((s) => s.focus);
  const events = useRadarStore((s) => s.events);

  const boostsQ = useRadarBoosts();
  const addrs = useMemo(
    () => (boostsQ.data ?? []).map((b) => b.tokenAddress).slice(0, 30),
    [boostsQ.data]
  );
  // ambient: slow poll (focused=false → 60s)
  const pairsQ = useRadarPairs(addrs, false);

  const pairs = useMemo(
    () => Object.values(pickBestPairs(pairsQ.data ?? [])),
    [pairsQ.data]
  );
  const blips = useMemo(() => toBlips(pairs), [pairs]);

  const movers = useMemo(
    () =>
      [...pairs]
        .sort(
          (a, b) =>
            Math.abs(b.priceChange?.h24 ?? 0) - Math.abs(a.priceChange?.h24 ?? 0)
        )
        .slice(0, 3),
    [pairs]
  );
  const lastEvents = events.slice(-2);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blipsRef = useRef<Blip[]>(blips);
  blipsRef.current = blips;
  /** set by the canvas effect; lets the data effect redraw the static frame */
  const drawRef = useRef<((now: number) => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let w = 0;
    let h = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced) draw(0);
    });
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver(([e]) => {
      visible = e?.isIntersecting ?? true;
    });
    io.observe(canvas);

    function draw(now: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) / 2 - 4;
      if (R <= 0) return;

      // concentric rings + crosshair
      ctx.strokeStyle = RING;
      ctx.lineWidth = 1;
      for (const f of [0.33, 0.66, 1]) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.stroke();

      const sweep = reduced
        ? Math.PI * 0.3 // static dressing
        : ((now % SWEEP_MS) / SWEEP_MS) * Math.PI * 2;

      // phosphor trail wedge
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, sweep - 0.8, sweep);
      ctx.closePath();
      ctx.fillStyle = "rgba(57, 255, 136, 0.06)";
      ctx.fill();
      ctx.restore();

      // sweep line
      ctx.save();
      ctx.strokeStyle = ACCENT;
      ctx.globalAlpha = 0.8;
      ctx.shadowColor = ACCENT;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
      ctx.stroke();
      ctx.restore();

      // blips — brighter just after the sweep passes them
      for (const b of blipsRef.current) {
        let diff = sweep - b.angle;
        diff = ((diff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const glow = reduced ? 0.4 : diff < 1.1 ? 1 - diff / 1.1 : 0;
        ctx.save();
        ctx.globalAlpha = 0.35 + 0.65 * glow;
        ctx.fillStyle = b.color;
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 3 + glow * 5;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(b.angle) * R * b.rFrac,
          cy + Math.sin(b.angle) * R * b.rFrac,
          b.size,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      }
    }

    drawRef.current = draw;

    if (reduced) {
      draw(0);
    } else {
      const loop = (now: number) => {
        if (visible) draw(now);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      drawRef.current = null;
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  // reduced-motion: re-render the static frame whenever new data lands
  useEffect(() => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    drawRef.current?.(0);
  }, [blips]);

  return (
    <button
      onClick={() => focus("radar")}
      className="scanlines relative block h-full w-full overflow-hidden text-left"
    >
      {/* scope */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* header */}
      <div className="pointer-events-none absolute left-2 top-1.5 font-mono text-[8px] uppercase tracking-[0.25em] text-dim">
        sweep scope
        <span className="m-display ml-2 text-[11px] tracking-normal text-[var(--m-accent)]">
          {pairs.length > 0 ? `${pairs.length} contacts` : boostsQ.isLoading ? "···" : "0"}
        </span>
      </div>

      {/* movers + spike lines */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-cell/90 via-cell/60 to-transparent px-2 pb-1.5 pt-4">
        {movers.map((p) => (
          <div
            key={p.baseToken.address}
            className="flex items-center font-mono text-[9px] leading-[1.5]"
          >
            <span className="truncate font-bold text-fg/85">{p.baseToken.symbol}</span>
            <span
              className={cn(
                "tnum ml-auto",
                (p.priceChange?.h24 ?? 0) >= 0 ? "text-up" : "text-down"
              )}
            >
              {fmtPct(p.priceChange?.h24)}
            </span>
          </div>
        ))}
        {pairs.length === 0 && (
          <div className="font-mono text-[9px] text-dim tek-pulse">scanning…</div>
        )}
        {lastEvents.map((l, i) => (
          <div
            key={`${l.ts}-${i}`}
            className="truncate font-mono text-[8.5px] leading-[1.5] text-warn"
          >
            {l.text}
          </div>
        ))}
      </div>
    </button>
  );
}
