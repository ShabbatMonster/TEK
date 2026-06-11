"use client";

import { Buffer } from "buffer";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  type ParsedTransactionWithMeta,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { getConnection, sendTx, MEMO_PROGRAM_ID } from "@/lib/solana";
import { shortAddr } from "@/lib/format";

export const MAX_MEMO_BYTES = 400;

export interface MemoMsg {
  signature: string;
  /** memo text with "[n] " bracket prefix and "TEK:" tag stripped */
  text: string;
  /** true when the memo carried the TEK: tag (sent from a TEK signal module) */
  isTek: boolean;
  counterparty: string;
  direction: "in" | "out";
  /** ms epoch */
  blockTime: number;
}

export interface Thread {
  counterparty: string;
  /** ascending by blockTime */
  messages: MemoMsg[];
  last: MemoMsg;
}

export function utf8Bytes(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Send an on-chain memo message: 1-lamport system transfer (so the tx lands
 * in the recipient's history) + SPL Memo instruction tagged "TEK:".
 */
export async function sendMemoMessage(
  wallet: WalletContextState,
  recipient: PublicKey,
  text: string
): Promise<string> {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const body = text.trim();
  if (!body) throw new Error("Empty message");
  if (utf8Bytes(body) > MAX_MEMO_BYTES) {
    throw new Error(`Message exceeds ${MAX_MEMO_BYTES} bytes`);
  }

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: recipient,
      lamports: 1,
    }),
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
      data: Buffer.from(`TEK:${body}`, "utf8"),
    })
  );

  return sendTx({
    tx,
    wallet,
    module: "signal",
    label: `Signal → ${shortAddr(recipient.toBase58())}`,
  });
}

/** RPC memo field looks like "[32] TEK:hello" — strip length prefix + TEK tag. */
export function parseMemoText(raw: string): { text: string; isTek: boolean } {
  let t = raw.replace(/^\[\d+\]\s*/, "");
  const isTek = t.startsWith("TEK:");
  if (isTek) t = t.slice(4);
  return { text: t.trim(), isTek };
}

function extractParties(
  tx: ParsedTransactionWithMeta,
  me: string
): { counterparty: string; direction: "in" | "out" } {
  const keys = tx.transaction.message.accountKeys;
  const feePayer = keys.find((k) => k.signer)?.pubkey.toBase58() ?? null;
  const direction: "in" | "out" = feePayer === me ? "out" : "in";

  // preferred: the parsed system transfer tells us both parties
  for (const ix of tx.transaction.message.instructions) {
    if ("parsed" in ix && ix.program === "system") {
      const parsed = ix.parsed as {
        type?: string;
        info?: { source?: string; destination?: string };
      };
      if (
        (parsed.type === "transfer" || parsed.type === "transferWithSeed") &&
        parsed.info?.source &&
        parsed.info?.destination
      ) {
        const cp =
          parsed.info.source === me ? parsed.info.destination : parsed.info.source;
        return { counterparty: cp, direction };
      }
    }
  }

  // fallback: the other signer, else any non-program account that isn't us
  const skip = new Set([
    me,
    MEMO_PROGRAM_ID.toBase58(),
    SystemProgram.programId.toBase58(),
  ]);
  const other =
    keys.find((k) => k.signer && !skip.has(k.pubkey.toBase58())) ??
    keys.find((k) => !skip.has(k.pubkey.toBase58()));
  return { counterparty: other?.pubkey.toBase58() ?? me, direction };
}

/**
 * Read the wallet's memo inbox from raw tx history. The signature listing
 * already carries the memo string; parsed details are fetched ONLY for txs
 * that actually contain a memo (public RPC friendliness).
 */
export async function fetchInbox(pubkey: PublicKey): Promise<MemoMsg[]> {
  const connection = getConnection();
  const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 40 });
  const memoSigs = sigs.filter((s) => s.memo != null && !s.err);
  if (memoSigs.length === 0) return [];

  const parsed = await connection.getParsedTransactions(
    memoSigs.map((s) => s.signature),
    { maxSupportedTransactionVersion: 0 }
  );

  const me = pubkey.toBase58();
  const out: MemoMsg[] = [];
  for (let i = 0; i < memoSigs.length; i++) {
    const info = memoSigs[i];
    const tx = parsed[i];
    if (!info || !tx) continue; // parsed tx can be null — skip gracefully
    try {
      const { text, isTek } = parseMemoText(info.memo ?? "");
      if (!text) continue;
      const { counterparty, direction } = extractParties(tx, me);
      out.push({
        signature: info.signature,
        text,
        isTek,
        counterparty,
        direction,
        blockTime: (tx.blockTime ?? info.blockTime ?? 0) * 1000,
      });
    } catch {
      // malformed tx shape — skip
    }
  }
  return out; // newest first (RPC signature order)
}

/** Group messages into per-counterparty threads, newest thread first. */
export function groupThreads(msgs: MemoMsg[]): Thread[] {
  const map = new Map<string, MemoMsg[]>();
  for (const m of msgs) {
    const arr = map.get(m.counterparty);
    if (arr) arr.push(m);
    else map.set(m.counterparty, [m]);
  }
  const threads: Thread[] = [];
  map.forEach((arr, counterparty) => {
    arr.sort((a, b) => a.blockTime - b.blockTime);
    const last = arr[arr.length - 1];
    if (last) threads.push({ counterparty, messages: arr, last });
  });
  threads.sort((a, b) => b.last.blockTime - a.last.blockTime);
  return threads;
}
