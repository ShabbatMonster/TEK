"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchBoosts, fetchPairs, fetchProfiles } from "./lib";
import { useRadarStore } from "./store";

export function useRadarBoosts() {
  return useQuery({
    queryKey: ["radar", "boosts"],
    queryFn: fetchBoosts,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}

export function useRadarProfiles() {
  return useQuery({
    queryKey: ["radar", "profiles"],
    queryFn: fetchProfiles,
    refetchInterval: 60_000,
    staleTime: 55_000,
  });
}

/**
 * Pair/market data for a set of token addresses.
 * Polls fast (30s) while the module is focused, slow (60s) when ambient.
 * Every fresh payload is fed to the spike-detection engine in the radar store
 * (deduped there by dataUpdatedAt, so Ambient + Focused can both call this).
 */
export function useRadarPairs(addrs: string[], focused: boolean) {
  const joined = addrs.join(",");
  const q = useQuery({
    queryKey: ["radar", "pairs", joined],
    queryFn: () => fetchPairs(addrs),
    enabled: addrs.length > 0,
    refetchInterval: focused ? 30_000 : 60_000,
    retry: 1,
  });

  const ingest = useRadarStore((s) => s.ingestPairs);
  useEffect(() => {
    if (q.data) ingest(q.data, q.dataUpdatedAt);
  }, [q.data, q.dataUpdatedAt, ingest]);

  return q;
}
