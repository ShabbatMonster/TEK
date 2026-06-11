"use client";

import { useEffect, useRef, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@solana/wallet-adapter-react";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import { TerminalFeed } from "@/components/tek/TerminalFeed";
import { Address } from "@/components/tek/Address";
import { sendTx } from "@/lib/solana";
import { toast } from "@/kernel/toast";
import { cn } from "@/lib/cn";
import {
  STEP_ORDER,
  economicsValid,
  identityValid,
  imageValid,
  useLaunchpadStore,
  type WizardStep,
} from "./store";

const STEP_LABELS: Record<WizardStep, string> = {
  identity: "identity",
  image: "image",
  economics: "economics",
  review: "review",
};

const DEV_BUY_PRESETS = ["0", "0.05", "0.25", "1"];

/* ---------------- small field primitives ---------------- */

function FieldLabel({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <div className="mb-1 flex items-baseline justify-between font-mono text-[9px] uppercase tracking-[0.22em]">
      <span className="text-dim">{text}</span>
      {optional && <span className="text-dim/50">optional</span>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-cell2/50 px-3 py-2 font-mono text-[12px] text-fg outline-none transition-colors placeholder:text-dim/60 focus:border-[var(--m-accent)]";

/* ---------------- live preview card ---------------- */

function LaunchPreviewCard() {
  const fields = useLaunchpadStore((s) => s.fields);
  const imageUrl = useLaunchpadStore((s) => s.imageUrl);

  const socials = [
    fields.twitter && "𝕏 twitter",
    fields.telegram && "◇ telegram",
    fields.website && "⌂ website",
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-line bg-cell2/40 p-3">
      <div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-dim">
        <span>live preview</span>
        <span className="text-[var(--m-accent)]">pump.fun</span>
      </div>
      <div className="flex gap-3">
        <div className="hazard flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-cell">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="token" className="h-full w-full object-cover" />
          ) : (
            <span className="font-mono text-[16px] text-dim">[^]</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="m-display truncate text-[15px] font-bold uppercase tracking-wide text-fg">
            {fields.name.trim() || <span className="text-dim/60">UNNAMED ASSET</span>}
          </div>
          <div className="font-mono text-[11px] font-bold text-[var(--m-accent)]">
            ${fields.symbol.trim().toUpperCase() || "TICKER"}
          </div>
          <div className="mt-1 line-clamp-3 font-mono text-[10px] leading-snug text-dim">
            {fields.description.trim() || "no description — degens will judge."}
          </div>
        </div>
      </div>
      {socials.length > 0 && (
        <div className="mt-2 flex gap-1.5 border-t border-line pt-2">
          {socials.map((s) => (
            <span
              key={s}
              className="rounded border border-line bg-cell px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-dim"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-line pt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-dim">
        <span>market cap $0 · bonding 0%</span>
        <span className="text-[var(--m-accent)]">created by you</span>
      </div>
    </div>
  );
}

/* ---------------- focused wizard ---------------- */

export default function LaunchpadFocused() {
  const wallet = useWallet();
  const s = useLaunchpadStore();
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    s.hydrate();
    return () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idOk = identityValid(s.fields);
  const imgOk = imageValid(s.imageFile);
  const ecoOk = economicsValid(s.devBuySol);
  const allOk = idOk && imgOk && ecoOk;

  function stepOk(step: WizardStep): boolean {
    if (step === "identity") return idOk;
    if (step === "image") return imgOk;
    if (step === "economics") return ecoOk;
    return allOk;
  }

  function disarm() {
    setArmed(false);
    if (armTimer.current) {
      clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  }

  function handleBigButton() {
    if (!allOk || !wallet.publicKey || s.launching) return;
    if (!armed) {
      setArmed(true);
      s.pushLine("ARMED — confirm within 3s to ignite", "warn");
      armTimer.current = setTimeout(() => {
        setArmed(false);
        useLaunchpadStore.getState().pushLine("disarmed — launch window elapsed", "dim");
      }, 3000);
      return;
    }
    disarm();
    void executeLaunch();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "Enter" || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    if (s.step === "review") {
      handleBigButton();
    } else if (stepOk(s.step)) {
      s.nextStep();
    }
  }

  async function executeLaunch() {
    const st = useLaunchpadStore.getState();
    const { fields, imageFile, devBuySol } = st;
    if (!wallet.publicKey) {
      toast({ kind: "error", title: "Launch aborted", body: "Connect a wallet first" });
      return;
    }
    if (!imageFile || !identityValid(fields) || !economicsValid(devBuySol)) return;

    const name = fields.name.trim();
    const symbol = fields.symbol.trim().toUpperCase();
    const push = st.pushLine;

    st.setLaunching(true);
    st.clearConsole();
    push(`>> LAUNCH SEQUENCE · ${symbol}`, "accent");

    const devBuy = parseFloat(devBuySol || "0") || 0;
    let txB64: string;
    let mintKp: Keypair;
    try {
      /* 1 — pin image + metadata */
      push("[1/4] pinning image → ipfs…", "dim");
      const fd = new FormData();
      fd.append("file", imageFile);
      fd.append("name", name);
      fd.append("symbol", symbol);
      fd.append("description", fields.description.trim());
      fd.append("twitter", fields.twitter.trim());
      fd.append("telegram", fields.telegram.trim());
      fd.append("website", fields.website.trim());
      fd.append("showName", "true");

      const ipfsRes = await fetch("/api/launchpad/ipfs", { method: "POST", body: fd });
      const ipfsJson = (await ipfsRes.json()) as { metadataUri?: string; error?: string };
      if (!ipfsRes.ok || ipfsJson.error || !ipfsJson.metadataUri) {
        throw new Error(ipfsJson.error ?? `ipfs pin failed: ${ipfsRes.status}`);
      }
      push(`[2/4] metadata uri ${ipfsJson.metadataUri}`, "up");

      /* 2 — mint keypair + create tx (create-only; dev-buy runs as a separate
         tx after confirmation — PumpPortal's combined create+buy path is
         currently unreliable, but create-only is solid) */
      mintKp = Keypair.generate();
      push(`mint ${mintKp.publicKey.toBase58()}`, "accent");
      push("[3/4] building create tx via pumpportal…", "dim");

      const createRes = await fetch("/api/launchpad/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey: wallet.publicKey.toBase58(),
          tokenMetadata: { name, symbol, uri: ipfsJson.metadataUri },
          mint: mintKp.publicKey.toBase58(),
          denominatedInSol: "true",
          amount: 0,
          slippage: 10,
          priorityFee: 0.0005,
          pool: "pump",
          action: "create",
        }),
      });
      const createJson = (await createRes.json()) as { tx?: string; error?: string };
      if (!createRes.ok || createJson.error || !createJson.tx) {
        throw new Error(createJson.error ?? `tx build failed: ${createRes.status}`);
      }
      txB64 = createJson.tx;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push(`!! ${msg}`, "down");
      push("sequence aborted — wizard state preserved", "warn");
      toast({ kind: "error", title: "Launch failed", body: msg.slice(0, 140) });
      st.setLaunching(false);
      return;
    }

    /* 3 — sign + send create (sendTx handles toasts + tx tracking) */
    const mint = mintKp.publicKey.toBase58();
    try {
      const tx = VersionedTransaction.deserialize(Buffer.from(txB64, "base64"));
      tx.sign([mintKp]);
      push("[4/4] awaiting wallet signature…", "warn");
      const signature = await sendTx({
        tx,
        wallet,
        module: "launchpad",
        label: `Launch ${symbol}`,
      });
      push(`sent ${signature}`, "dim");
      push("confirmed — token is live", "up");
      push(`https://pump.fun/coin/${mint}`, "accent");
      st.addLaunch({ mint, name, symbol, signature, ts: Date.now() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      push(`!! ${msg.slice(0, 200)}`, "down");
      push("sequence aborted — wizard state preserved", "warn");
      st.setLaunching(false);
      return;
    }

    /* 4 — optional dev-buy as a separate purchase against the live curve */
    if (devBuy > 0) {
      try {
        push(`dev-buy → purchasing ${devBuy} ◎ of ${symbol}…`, "dim");
        const buyRes = await fetch("/api/launchpad/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            publicKey: wallet.publicKey.toBase58(),
            mint,
            denominatedInSol: "true",
            amount: devBuy,
            slippage: 15,
            priorityFee: 0.0005,
            pool: "pump",
            action: "buy",
          }),
        });
        const buyJson = (await buyRes.json()) as { tx?: string; error?: string };
        if (!buyRes.ok || buyJson.error || !buyJson.tx) {
          throw new Error(buyJson.error ?? `buy build failed: ${buyRes.status}`);
        }
        const buyTx = VersionedTransaction.deserialize(Buffer.from(buyJson.tx, "base64"));
        await sendTx({ tx: buyTx, wallet, module: "launchpad", label: `Dev-buy ${symbol}` });
        push(`dev-buy confirmed — you hold the first bag`, "up");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        push(`dev-buy skipped: ${msg.slice(0, 160)}`, "warn");
        push("token is live regardless — buy manually on pump.fun", "dim");
      }
    }
    st.setLaunching(false);
  }

  function onFilePicked(f: File | null) {
    if (f && !f.type.startsWith("image/")) {
      toast({ kind: "warn", title: "Not an image", body: f.type || "unknown file type" });
      return;
    }
    s.setImage(f);
  }

  const stepIdx = STEP_ORDER.indexOf(s.step);

  return (
    <div className="flex h-full gap-4 overflow-y-auto p-5" onKeyDown={handleKeyDown}>
      {/* ---------------- left: wizard ---------------- */}
      <div className="flex w-[46%] min-w-[300px] flex-col">
        {/* step rail */}
        <div className="mb-4 flex items-center gap-1">
          {STEP_ORDER.map((step, i) => (
            <button
              key={step}
              onClick={() => s.setStep(step)}
              className={cn(
                "flex-1 border-b-2 pb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] transition-colors",
                s.step === step
                  ? "border-[var(--m-accent)] text-[var(--m-accent)]"
                  : stepOk(step)
                    ? "border-up/40 text-up/80"
                    : "border-line text-dim hover:text-fg"
              )}
            >
              {String(i + 1).padStart(2, "0")} {STEP_LABELS[step]} {stepOk(step) && s.step !== step ? "✓" : ""}
            </button>
          ))}
        </div>

        {/* step body */}
        <div className="min-h-0 flex-1 space-y-3">
          {s.step === "identity" && (
            <>
              <div>
                <FieldLabel text="token name" />
                <input
                  autoFocus
                  value={s.fields.name}
                  maxLength={32}
                  onChange={(e) => s.setField("name", e.target.value)}
                  placeholder="Molten Industries"
                  className={inputCls}
                />
              </div>
              <div>
                <FieldLabel text="ticker symbol" />
                <input
                  value={s.fields.symbol}
                  maxLength={10}
                  onChange={(e) => s.setField("symbol", e.target.value.replace(/\s/g, ""))}
                  placeholder="MOLTEN"
                  className={cn(inputCls, "uppercase")}
                />
              </div>
              <div>
                <FieldLabel text="description" optional />
                <textarea
                  value={s.fields.description}
                  rows={3}
                  maxLength={500}
                  onChange={(e) => s.setField("description", e.target.value)}
                  placeholder="what is this thing"
                  className={cn(inputCls, "resize-none")}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["twitter", "telegram", "website"] as const).map((k) => (
                  <div key={k}>
                    <FieldLabel text={k} optional />
                    <input
                      value={s.fields[k]}
                      onChange={(e) => s.setField(k, e.target.value)}
                      placeholder="https://"
                      className={inputCls}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {s.step === "image" && (
            <div>
              <FieldLabel text="token image" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onFilePicked(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  onFilePicked(e.dataTransfer.files?.[0] ?? null);
                }}
                className={cn(
                  "flex h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors",
                  s.imageUrl
                    ? "border-[var(--m-accent)]/50 bg-[var(--m-glow)]"
                    : "hazard border-line hover:border-[var(--m-accent)]"
                )}
              >
                {s.imageUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.imageUrl}
                      alt="preview"
                      className="h-28 w-28 rounded-lg border border-line object-cover"
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-dim">
                      {s.imageFile?.name} · click to replace
                    </span>
                  </>
                ) : (
                  <>
                    <span className="m-display text-2xl font-bold text-[var(--m-accent)]">[^]</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-dim">
                      drop image / click to select
                    </span>
                    <span className="font-mono text-[9px] text-dim/60">png · jpg · gif — square preferred</span>
                  </>
                )}
              </button>
              {s.imageFile && (
                <button
                  onClick={() => s.setImage(null)}
                  className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-dim hover:text-down"
                >
                  × clear image
                </button>
              )}
            </div>
          )}

          {s.step === "economics" && (
            <>
              <div>
                <FieldLabel text="dev buy (sol)" />
                <div className="flex items-center gap-2 rounded-lg border border-line bg-cell2/50 px-3 py-2 focus-within:border-[var(--m-accent)]">
                  <input
                    autoFocus
                    value={s.devBuySol}
                    inputMode="decimal"
                    placeholder="0.00"
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^[0-9]*\.?[0-9]*$/.test(v)) s.setDevBuySol(v);
                    }}
                    className="tnum w-full bg-transparent font-mono text-lg font-bold text-fg outline-none placeholder:text-dim/60"
                  />
                  <span className="font-mono text-[10px] font-bold text-[var(--m-accent)]">SOL</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {DEV_BUY_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => s.setDevBuySol(p)}
                      className={cn(
                        "rounded border px-2 py-1 font-mono text-[10px]",
                        s.devBuySol === p
                          ? "border-[var(--m-accent)] text-[var(--m-accent)]"
                          : "border-line text-dim hover:text-fg"
                      )}
                    >
                      {p === "0" ? "NONE" : `${p} ◎`}
                    </button>
                  ))}
                </div>
                {!ecoOk && (
                  <div className="mt-2 font-mono text-[10px] text-down">dev buy must be 0 – 85 SOL</div>
                )}
              </div>
              <div className="space-y-1.5 rounded-xl border border-line p-3 font-mono text-[10px]">
                <div className="flex justify-between">
                  <span className="text-dim">slippage on dev buy</span>
                  <span className="tnum text-fg">10%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">priority fee</span>
                  <span className="tnum text-fg">0.0005 ◎</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-dim">pool</span>
                  <span className="text-[var(--m-accent)]">PUMP</span>
                </div>
              </div>
              <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.15em] text-dim/70">
                dev buy executes in the same tx as the create — you snipe your own curve at block zero.
              </p>
            </>
          )}

          {s.step === "review" && (
            <>
              <div className="space-y-1.5 rounded-xl border border-line p-3 font-mono text-[10px]">
                {(
                  [
                    ["name", s.fields.name.trim() || "—"],
                    ["symbol", s.fields.symbol.trim().toUpperCase() || "—"],
                    ["image", s.imageFile?.name ?? "MISSING"],
                    ["dev buy", `${s.devBuySol.trim() || "0"} ◎`],
                    ["slippage / prio", "10% / 0.0005 ◎"],
                    ["wallet", wallet.publicKey ? wallet.publicKey.toBase58().slice(0, 8) + "…" : "NOT CONNECTED"],
                  ] as const
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <span className="uppercase tracking-[0.15em] text-dim">{k}</span>
                    <span
                      className={cn(
                        "truncate text-right",
                        v === "MISSING" || v === "NOT CONNECTED" ? "text-down" : "text-fg"
                      )}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              {s.lastLaunch ? (
                <div className="space-y-2 rounded-xl border border-up/40 bg-up/5 p-3">
                  <div className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-up">
                    ◉ {s.lastLaunch.symbol} is live
                  </div>
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-dim">mint</span>
                    <Address addr={s.lastLaunch.mint} chars={6} className="text-fg" />
                  </div>
                  <a
                    href={`https://pump.fun/coin/${s.lastLaunch.mint}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate font-mono text-[10px] text-[var(--m-accent)] hover:underline"
                  >
                    pump.fun/coin/{s.lastLaunch.mint.slice(0, 12)}…
                  </a>
                  <button
                    onClick={s.resetWizard}
                    className="w-full rounded-lg border border-line py-1.5 font-mono text-[10px] uppercase tracking-[0.25em] text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
                  >
                    new launch
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleBigButton}
                  disabled={!allOk || !wallet.publicKey || s.launching}
                  className={cn(
                    "m-display w-full rounded-xl border-2 py-4 text-lg font-bold uppercase tracking-[0.35em] transition-all",
                    s.launching
                      ? "cursor-wait border-[var(--m-accent)] text-[var(--m-accent)] tek-pulse"
                      : !allOk || !wallet.publicKey
                        ? "cursor-not-allowed border-line text-dim"
                        : armed
                          ? "hazard border-[var(--m-accent2,#ff3d00)] bg-[var(--m-glow)] text-[var(--m-accent)] shadow-[0_0_24px_var(--m-glow)]"
                          : "border-[var(--m-accent)] text-[var(--m-accent)] hover:bg-[var(--m-glow)]"
                  )}
                >
                  {s.launching
                    ? "LAUNCHING…"
                    : !wallet.publicKey
                      ? "CONNECT WALLET"
                      : !allOk
                        ? "INCOMPLETE"
                        : armed
                          ? "▶ LAUNCH"
                          : "ARM"}
                </button>
              )}
              {armed && !s.launching && (
                <div className="text-center font-mono text-[9px] uppercase tracking-[0.3em] text-warn tek-pulse">
                  armed — fire within 3s
                </div>
              )}
            </>
          )}
        </div>

        {/* nav */}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          <button
            onClick={s.prevStep}
            disabled={stepIdx === 0}
            className={cn(
              "rounded border border-line px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
              stepIdx === 0 ? "cursor-not-allowed text-dim/40" : "text-dim hover:text-fg"
            )}
          >
            ← back
          </button>
          <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-dim/60">
            ↵ advance
          </span>
          {stepIdx < STEP_ORDER.length - 1 ? (
            <button
              onClick={() => stepOk(s.step) && s.nextStep()}
              disabled={!stepOk(s.step)}
              className={cn(
                "rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
                stepOk(s.step)
                  ? "border-[var(--m-accent)] text-[var(--m-accent)] hover:bg-[var(--m-glow)]"
                  : "cursor-not-allowed border-line text-dim/40"
              )}
            >
              next →
            </button>
          ) : (
            <span className="w-[72px]" />
          )}
        </div>
      </div>

      {/* ---------------- right: preview + console ---------------- */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <LaunchPreviewCard />
        <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-cell2/30">
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.22em] text-dim">
            <span>launch console</span>
            <span className={cn(s.launching ? "text-[var(--m-accent)] tek-pulse" : "text-dim/50")}>
              {s.launching ? "● ACTIVE" : "○ STANDBY"}
            </span>
          </div>
          <TerminalFeed
            lines={
              s.lines.length > 0
                ? s.lines
                : [{ text: "console standby — complete the sequence and arm.", tone: "dim" as const }]
            }
            showTime
            className="min-h-0 flex-1 p-2"
          />
        </div>
      </div>
    </div>
  );
}
