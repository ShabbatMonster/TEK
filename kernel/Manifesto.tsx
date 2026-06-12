"use client";

import { MODULES } from "@/modules/registry";
import { useKernelStore } from "./store";
import type { ModuleId } from "./types";

const CA = "5j2FX52WzQNtiLDwGLbsm9UZP51d8tNk7Z2yWvWBPtek";

const TECH: Record<ModuleId, string> = {
  launchpad:
    "Mints SPL tokens straight onto pump.fun bonding curves via PumpPortal — constant-product virtual reserves, no LP to seed, graduation when the curve fills.",
  swap:
    "Jupiter v6 aggregated routing — quotes split across every AMM and CLOB on Solana, slippage-bounded, shipped as versioned transactions with address lookup tables.",
  shadowswap:
    "Counter-surveillance toolkit — burner keypairs that exist only in tab memory and an AES-GCM vault keyed by PBKDF2 (100k rounds). Nothing ever leaves the browser.",
  incinerator:
    "Burns dust SPL balances and closes empty token accounts to reclaim rent-exempt lamports — every dead ATA refunds ~0.002 SOL back to your wallet.",
  radar:
    "Token intelligence sweeps — holder concentration, mint/freeze authority flags, liquidity depth. The due diligence you were supposed to do.",
  oracle:
    "An AI analyst wired to live cluster state — ask about any mint, wallet, or signature and it reads the chain before it answers.",
  forge:
    "Static-analysis repo auditor — point it at a codebase and get severity-ranked findings like a security shop on retainer.",
  perps:
    "Drift protocol perpetuals through the DLOB — a decentralized limit order book with cross-margin, funding rates, and a live depth feed.",
  signal:
    "Wallet-to-wallet memos over the SPL Memo program — messages as transactions, signed by your key and timestamped by the cluster itself.",
};

export function Manifesto() {
  const open = useKernelStore((s) => s.manifestoOpen);
  const setOpen = useKernelStore((s) => s.setManifestoOpen);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="max-h-[88vh] w-[720px] max-w-[94vw] overflow-y-auto rounded-xl border border-line bg-cell p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.3em] text-dim">
          TEK · READ.ME
        </div>
        <h1 className="font-mono text-xl font-bold tracking-[0.2em] text-fg">
          THE EVERYTHING KERNEL
        </h1>

        <div className="mt-4 space-y-3 text-[12px] leading-relaxed text-fg/90">
          <p>
            <span className="text-fg font-bold">tek.cash</span> is a Solana operating
            system that fits in one viewport. Nine independent applications — a token
            foundry, a DEX aggregator, a privacy toolkit, a rent reclaimer, a token
            scanner, an AI analyst, a code auditor, a perps terminal, and an on-chain
            messenger — rendered as a 3×3 grid. Zero scrolling. Zero tabs.
          </p>
          <p>
            Crypto UX is fragmented by default: trading means ten browser tabs, ten
            wallet-adapter handshakes, ten RPC connections all polling the same cluster,
            and your signing context scattered across origins you barely vetted. TEK
            collapses that into a single process — one wallet session shared by all nine
            modules, one Helius RPC/WebSocket pool deduped through a query cache, one
            keyboard map. Modules compose over a typed pub/sub bus the way Solana
            programs compose over CPI: Radar surfaces a mint, Swap quotes it, Oracle
            explains it, the Incinerator sweeps the dust when you&apos;re done.
            Composability at the UI layer, mirroring composability at the protocol layer.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MODULES.map((m) => (
            <div key={m.id} data-module={m.id} className="rounded border border-line p-2.5">
              <div className="m-accent mb-1 flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-widest">
                <span>{m.glyph}</span>
                <span className="font-bold">{m.title}</span>
              </div>
              <p className="text-[11px] leading-snug text-dim">{TECH[m.id]}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[12px] leading-relaxed text-fg/90">
          Under the hood it&apos;s a kernel in the honest sense — a thin shared layer
          every module plugs into. Each cell is a sandboxed mini-app with its own state
          store and visual identity; the kernel owns the wallet adapter context, the
          grid↔focus layout engine, the hotkey table, and the event bus. A wallet change
          fires a reset registry across all nine stores so no stale account state
          survives a key switch. Everything signs through the one adapter you connected —
          no module ever touches a private key.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <span className="font-mono text-[9px] uppercase tracking-widest text-dim">CA</span>
          <span className="truncate font-mono text-[10px] text-fg">{CA}</span>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto rounded border border-line bg-cell2 px-4 py-1 font-mono text-[11px] uppercase tracking-widest text-fg hover:border-up hover:text-up"
          >
            Enter the kernel →
          </button>
        </div>
      </div>
    </div>
  );
}
