import type { ComponentType, ReactNode } from "react";

export type ModuleId =
  | "launchpad"
  | "swap"
  | "shadowswap"
  | "incinerator"
  | "radar"
  | "oracle"
  | "forge"
  | "perps"
  | "signal";

export const MODULE_IDS: ModuleId[] = [
  "launchpad",
  "swap",
  "shadowswap",
  "incinerator",
  "radar",
  "oracle",
  "forge",
  "perps",
  "signal",
];

export interface ModuleHotkey {
  key: string;
  label: string;
}

export interface PaletteCommand {
  id: string;
  label: string;
  hint?: string;
  /** Module to focus when executed (the module reads palette payload from its store) */
  run: () => void;
}

export interface ModuleDefinition {
  id: ModuleId;
  /** 1-9, left-to-right top-to-bottom */
  slot: number;
  title: string;
  tagline: string;
  /** small glyph string/element for chrome + dock */
  glyph: ReactNode;
  /** css color used by kernel chrome for this module */
  accent: string;
  /** dense resting view rendered in the grid cell */
  Ambient: ComponentType;
  /** full app rendered in focus mode (modules should next/dynamic this) */
  Focused: ComponentType;
  hotkeys?: ModuleHotkey[];
  commands?: PaletteCommand[];
}

/* ---------- Event bus payloads ---------- */

export interface TekEvents {
  "token:inspect": { mint: string; symbol?: string; source: ModuleId };
  "token:swap": { inputMint?: string; outputMint: string; symbol?: string };
  "token:burn": { mint: string };
  "oracle:ask": { prompt: string };
  "signal:compose": { recipient: string };
  "tx:submitted": { signature: string; module: ModuleId; label: string };
  "tx:confirmed": { signature: string; module: ModuleId; label: string };
  "tx:failed": { module: ModuleId; label: string; error: string };
  "wallet:changed": { pubkey: string | null };
}

export type TekEventKey = keyof TekEvents;
