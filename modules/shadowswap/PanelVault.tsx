"use client";

import { useEffect, useState } from "react";
import { ScrambleText } from "@/components/tek/ScrambleText";
import { toast } from "@/kernel/toast";
import { cn } from "@/lib/cn";
import { useShadowStore } from "./store";
import {
  createVault,
  destroyVault,
  hasVault,
  persistVault,
  unlockVault,
  type VaultNote,
} from "./vault";

export function PanelVault() {
  const s = useShadowStore();
  const [exists, setExists] = useState(false);
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [armDestroy, setArmDestroy] = useState(false);

  useEffect(() => {
    setExists(hasVault());
  }, []);

  async function handleCreate() {
    if (pass.length < 8) {
      setErr("PASSPHRASE TOO SHORT — 8 CHARACTERS MINIMUM");
      return;
    }
    if (pass !== confirm) {
      setErr("PASSPHRASES DO NOT MATCH");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { key, salt } = await createVault(pass);
      s.setVaultSession(key, salt, []);
      setExists(true);
      setPass("");
      setConfirm("");
      toast({ kind: "success", title: "Vault created", body: "AES-GCM · PBKDF2 100k · local only" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true);
    setErr(null);
    try {
      const { key, salt, notes } = await unlockVault(pass);
      s.setVaultSession(key, salt, notes);
      setPass("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveNotes(notes: VaultNote[]) {
    if (!s.vaultKey || !s.vaultSalt) return;
    const prev = s.vaultNotes;
    s.setVaultNotes(notes);
    try {
      await persistVault(s.vaultKey, s.vaultSalt, notes);
    } catch (e) {
      s.setVaultNotes(prev);
      toast({ kind: "error", title: "Vault write failed", body: e instanceof Error ? e.message : String(e) });
    }
  }

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void saveNotes([
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, at: Date.now() },
      ...s.vaultNotes,
    ]);
  }

  function handleDestroy() {
    if (!armDestroy) {
      setArmDestroy(true);
      return;
    }
    destroyVault();
    s.lockVault();
    setExists(false);
    setArmDestroy(false);
    toast({ kind: "warn", title: "Vault destroyed", body: "ciphertext erased — unrecoverable" });
  }

  const inputCls =
    "w-full border border-line bg-void/60 px-3 py-2 font-mono text-[11px] text-fg outline-none placeholder:text-dim focus:border-[var(--m-accent)]";

  /* ---------------- no vault yet: create ---------------- */
  if (!exists && !s.vaultUnlocked) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="border border-line bg-cell2/40 p-4">
          <ScrambleText
            text="LOCAL VAULT — INITIALIZE"
            className="m-display text-sm font-bold tracking-[0.25em] text-[var(--m-accent)]"
          />
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-fg/60">
            Encrypted note storage for shielded-pool notes and anything else
            small. AES-GCM 256, key derived from your passphrase via PBKDF2
            (100,000 iterations, random salt). Ciphertext lives in this
            browser&apos;s localStorage. Nothing ever leaves the device.
          </p>
          <div className="mt-4 space-y-2">
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="passphrase (min 8 chars)"
              className={inputCls}
            />
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
              placeholder="confirm passphrase"
              className={inputCls}
            />
          </div>
          {err && <div className="mt-2 font-mono text-[9px] text-down">{err}</div>}
          <button
            onClick={() => void handleCreate()}
            disabled={busy}
            className="mt-3 w-full border border-[var(--m-accent)] bg-[var(--m-glow)] py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black disabled:opacity-50"
          >
            {busy ? "deriving key…" : "create vault"}
          </button>
        </div>
        <div className="border border-down/50 bg-down/5 p-3 font-mono text-[9px] leading-relaxed text-fg/60">
          <span className="font-bold tracking-[0.2em] text-down">⚠ NO RECOVERY.</span>{" "}
          Forget the passphrase and the contents are cryptographically gone.
          TEK holds no copy of anything.
        </div>
      </div>
    );
  }

  /* ---------------- locked ---------------- */
  if (!s.vaultUnlocked) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="border border-line bg-cell2/40 p-4">
          <div className="flex items-center justify-between">
            <ScrambleText
              text="VAULT LOCKED"
              className="m-display text-sm font-bold tracking-[0.3em] text-[var(--m-accent)]"
            />
            <span className="font-mono text-[10px] text-dim">⬢ sealed</span>
          </div>
          <div className="mt-3 space-y-1 font-mono text-[11px] text-dim">
            <div>▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
            <div>▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
            <div>▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</div>
          </div>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleUnlock()}
            placeholder="passphrase"
            className={cn(inputCls, "mt-4")}
          />
          {err && <div className="mt-2 font-mono text-[9px] text-down">{err}</div>}
          <button
            onClick={() => void handleUnlock()}
            disabled={busy || pass.length === 0}
            className="mt-3 w-full border border-[var(--m-accent)] bg-[var(--m-glow)] py-2 font-mono text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--m-accent)] hover:bg-[var(--m-accent)] hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "decrypting…" : "unlock"}
          </button>
        </div>
        <button
          onClick={handleDestroy}
          className={cn(
            "w-full border py-1.5 font-mono text-[9px] uppercase tracking-[0.25em]",
            armDestroy
              ? "border-down bg-down/10 text-down"
              : "border-line text-dim hover:border-down/50 hover:text-down"
          )}
        >
          {armDestroy ? "click again — erase ciphertext forever" : "destroy vault"}
        </button>
      </div>
    );
  }

  /* ---------------- unlocked ---------------- */
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="border border-line bg-cell2/40 p-4">
        <div className="flex items-center justify-between">
          <ScrambleText
            text="VAULT OPEN"
            className="m-display text-sm font-bold tracking-[0.3em] text-up"
          />
          <button
            onClick={() => s.lockVault()}
            className="border border-line px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em] text-dim hover:border-[var(--m-accent)] hover:text-[var(--m-accent)]"
          >
            lock now
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            placeholder="new note — encrypted on save"
            className={inputCls}
          />
          <button
            onClick={addNote}
            disabled={!draft.trim()}
            className="shrink-0 border border-[var(--m-accent)]/60 px-3 font-mono text-[10px] uppercase text-[var(--m-accent)] hover:bg-[var(--m-glow)] disabled:opacity-40"
          >
            add
          </button>
        </div>

        <div className="mt-3 space-y-1.5">
          {s.vaultNotes.length === 0 && (
            <div className="font-mono text-[10px] text-dim">vault is empty</div>
          )}
          {s.vaultNotes.map((n) => (
            <div
              key={n.id}
              className="group flex items-center gap-2 border border-line bg-void/40 px-2 py-1.5 font-mono text-[10px]"
            >
              <span className="text-[var(--m-accent)]">◈</span>
              <span className="min-w-0 flex-1 break-all text-fg/85">{n.text}</span>
              <span className="tnum shrink-0 text-[9px] text-dim">
                {new Date(n.at).toISOString().slice(0, 10)}
              </span>
              <button
                onClick={() => void saveNotes(s.vaultNotes.filter((x) => x.id !== n.id))}
                className="shrink-0 text-dim opacity-0 transition-opacity hover:text-down group-hover:opacity-100"
                title="shred note"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-dim">
          aes-gcm 256 · pbkdf2 100k · localStorage[&apos;tek:shadow:vault&apos;]
        </span>
        <button
          onClick={handleDestroy}
          className={cn(
            "border px-3 py-1 font-mono text-[9px] uppercase tracking-[0.2em]",
            armDestroy
              ? "border-down bg-down/10 text-down"
              : "border-line text-dim hover:border-down/50 hover:text-down"
          )}
        >
          {armDestroy ? "confirm destroy" : "destroy vault"}
        </button>
      </div>
    </div>
  );
}
