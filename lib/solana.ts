"use client";

import { Connection, PublicKey, VersionedTransaction, Transaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { useKernelStore } from "@/kernel/store";
import { bus } from "@/kernel/bus";
import { toast } from "@/kernel/toast";
import type { ModuleId } from "@/kernel/types";

/** Public websocket for tx-confirmation subscriptions (no key needed). */
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "wss://solana-rpc.publicnode.com";

/** HTTP endpoint — always the same-origin proxy in the browser so the key
 *  stays server-side and heavy methods aren't blocked by browser-IP rules. */
export function rpcHttpEndpoint(): string {
  if (typeof window !== "undefined") return `${window.location.origin}/api/rpc`;
  return process.env.NEXT_PUBLIC_RPC_URL || "https://solana-rpc.publicnode.com";
}

export const RPC_URL = rpcHttpEndpoint();

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(rpcHttpEndpoint(), {
      commitment: "confirmed",
      wsEndpoint: WS_URL,
    });
  }
  return _connection;
}

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export function explorerTx(sig: string): string {
  return `https://solscan.io/tx/${sig}`;
}
export function explorerAddr(addr: string): string {
  return `https://solscan.io/account/${addr}`;
}

/**
 * Unified send pipeline: every module sends transactions through here so
 * tracking, toasts, and bus events are consistent OS-wide.
 */
export async function sendTx(opts: {
  tx: Transaction | VersionedTransaction;
  wallet: WalletContextState;
  module: ModuleId;
  label: string;
}): Promise<string> {
  const { tx, wallet, module, label } = opts;
  const connection = getConnection();
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  if (tx instanceof Transaction) {
    tx.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
  }

  const signed = await wallet.signTransaction(tx);
  const raw = signed.serialize();
  const signature = await connection.sendRawTransaction(raw, {
    skipPreflight: false,
    maxRetries: 3,
  });

  useKernelStore.getState().trackTx({ signature, module, label, status: "pending", at: Date.now() });
  bus.emit("tx:submitted", { signature, module, label });
  toast({ kind: "info", title: `${label} submitted`, body: signature.slice(0, 16) + "…", href: explorerTx(signature) });

  try {
    const latest = await connection.getLatestBlockhash();
    const conf = await connection.confirmTransaction(
      { signature, ...latest },
      "confirmed"
    );
    if (conf.value.err) throw new Error(JSON.stringify(conf.value.err));
    useKernelStore.getState().updateTx(signature, "confirmed");
    bus.emit("tx:confirmed", { signature, module, label });
    toast({ kind: "success", title: `${label} confirmed`, href: explorerTx(signature) });
    return signature;
  } catch (e) {
    useKernelStore.getState().updateTx(signature, "failed");
    const error = e instanceof Error ? e.message : String(e);
    bus.emit("tx:failed", { module, label, error });
    toast({ kind: "error", title: `${label} failed`, body: error.slice(0, 140) });
    throw e;
  }
}

export function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}
