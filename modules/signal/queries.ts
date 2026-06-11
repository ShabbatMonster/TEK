"use client";

import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { useKernelStore } from "@/kernel/store";
import { toast } from "@/kernel/toast";
import { shortAddr } from "@/lib/format";
import { fetchInbox, type MemoMsg } from "./lib";
import { useSignalStore } from "./store";

/** captured from the active hook so palette commands can refresh imperatively */
let qc: QueryClient | null = null;
/** last data array fed through new-message detection (shared cache reference) */
let lastProcessed: MemoMsg[] | null = null;

export function refreshInbox(): void {
  void qc?.invalidateQueries({ queryKey: ["signal", "inbox"] });
}

export function useInbox(): UseQueryResult<MemoMsg[]> {
  const { publicKey } = useWallet();
  const focused = useKernelStore((s) => s.focused === "signal");
  const queryClient = useQueryClient();

  useEffect(() => {
    qc = queryClient;
  }, [queryClient]);

  const query = useQuery({
    queryKey: ["signal", "inbox", publicKey?.toBase58() ?? "none"],
    queryFn: () => fetchInbox(publicKey!),
    enabled: !!publicKey, // never poll without a wallet
    staleTime: 60_000,
    // public RPC is rate-limited: only auto-poll while the module is focused;
    // ambient reads the cache + manual refresh button
    refetchInterval: focused ? 120_000 : false,
    retry: 1,
  });

  const data = query.data;
  useEffect(() => {
    if (!data || data === lastProcessed) return;
    lastProcessed = data; // both Ambient & Focused share the cache reference — process once
    const fresh = useSignalStore.getState().absorbInbox(data);
    for (const m of fresh.slice(0, 3)) {
      toast({
        kind: "info",
        title: "SIGNAL RECEIVED",
        body: `${shortAddr(m.counterparty)} ◂ ${m.text.slice(0, 64)}`,
      });
    }
  }, [data]);

  return query;
}
