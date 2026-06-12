"use client";

import { useEffect, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { rpcHttpEndpoint } from "@/lib/solana";
import { fireWalletResets } from "./store";
import { bus } from "./bus";
import { GridEngine } from "./GridEngine";
import { StatusBar } from "./StatusBar";
import { CaBanner } from "./CaBanner";
import { HotkeyManager } from "./HotkeyManager";
import { CommandPalette } from "./CommandPalette";
import { CheatSheet } from "./CheatSheet";
import { ToastOS } from "./ToastOS";

function WalletChangeWatcher() {
  const { publicKey } = useWallet();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const now = publicKey?.toBase58() ?? null;
    if (prev.current !== now) {
      if (prev.current !== null || now === null) fireWalletResets();
      bus.emit("wallet:changed", { pubkey: now });
      prev.current = now;
    }
  }, [publicKey]);
  return null;
}

export default function TekKernel() {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={rpcHttpEndpoint()}>
        <WalletProvider wallets={[]} autoConnect>
          <WalletChangeWatcher />
          <HotkeyManager />
          <div className="kernel-shell flex flex-col bg-void p-[var(--tek-gap)]">
            <CaBanner />
            <StatusBar />
            <GridEngine />
          </div>
          <CommandPalette />
          <CheatSheet />
          <ToastOS />
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
