"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchL2, type L2Book, type PerpMarket } from "./lib";
import { usePerpsStore } from "./store";

/**
 * L2 book poll. Caller decides cadence: 2000ms when the module is focused,
 * 10000ms ambient (read focused state via useKernelStore in the component).
 */
export function useL2Book(market: PerpMarket, intervalMs: number) {
  return useQuery({
    queryKey: ["perps", "l2", market],
    queryFn: () => fetchL2(market, 16),
    refetchInterval: intervalMs,
    staleTime: Math.min(intervalMs, 2000) / 2,
    retry: 1,
  });
}

/** Persist each good book into the perps store (lastGoodBook + mid tick direction). */
export function useRecordBook(market: PerpMarket, book: L2Book | undefined) {
  const recordBook = usePerpsStore((s) => s.recordBook);
  useEffect(() => {
    if (book) recordBook(market, book);
  }, [book, market, recordBook]);
}
