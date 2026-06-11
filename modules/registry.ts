import type { ModuleDefinition } from "@/kernel/types";
import { launchpad } from "./launchpad";
import { swap } from "./swap";
import { shadowswap } from "./shadowswap";
import { incinerator } from "./incinerator";
import { radar } from "./radar";
import { oracle } from "./oracle";
import { forge } from "./forge";
import { perps } from "./perps";
import { signal } from "./signal";

/** The only file that knows all nine. Order = grid slots 1..9. */
export const MODULES: ModuleDefinition[] = [
  launchpad,
  swap,
  shadowswap,
  incinerator,
  radar,
  oracle,
  forge,
  perps,
  signal,
].sort((a, b) => a.slot - b.slot);
