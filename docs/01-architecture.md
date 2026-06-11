# 01 — Product Architecture

## 1. System Overview

TEK is a **client-heavy single-page application** with a thin server. The browser does as much as possible: wallet signing, transaction construction, websocket subscriptions, optimistic UI. The server exists for four things only:

1. **Secrets proxying** — Helius/Birdeye/AI API keys never reach the client
2. **Persistence** — Signal messages, Forge reports, Oracle history, user prefs
3. **AI inference** — Oracle and Forge stream Claude responses via route handlers
4. **Heavy computation** — Forge repo cloning/analysis runs in background jobs

```
┌──────────────────────────────────────────────────────────────────┐
│ BROWSER (Next.js client)                                         │
│                                                                  │
│  ┌────────────────────────  KERNEL  ──────────────────────────┐  │
│  │ WalletProvider · LayoutEngine · HotkeyManager · EventBus   │  │
│  │ CommandPalette · ThemeBridge · ToastOS · ConnectionManager │  │
│  └────────────────────────────────────────────────────────────┘  │
│       ▲          ▲          ▲          ▲          ▲              │
│  ┌────┴───┐ ┌────┴───┐ ┌────┴───┐ ┌────┴───┐ ┌────┴───┐  ×9     │
│  │ Module │ │ Module │ │ Module │ │ Module │ │ Module │         │
│  │ shell  │ │ shell  │ │ shell  │ │ shell  │ │ shell  │         │
│  │ +store │ │ +store │ │ +store │ │ +store │ │ +store │         │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘         │
└──────────┬──────────────────┬───────────────────┬────────────────┘
           │                  │                   │
   direct from client   Next.js route        websockets
           │              handlers                │
           ▼                  ▼                   ▼
  ┌─────────────┐   ┌──────────────────┐  ┌──────────────┐
  │ Solana RPC  │   │ /api/* (proxy,   │  │ Helius WS    │
  │ Jupiter API │   │  AI streams,     │  │ Drift WS     │
  │ Drift DLOB  │   │  Forge jobs)     │  │ Supabase RT  │
  └─────────────┘   └────────┬─────────┘  └──────────────┘
                             ▼
                   ┌──────────────────┐
                   │ Supabase (PG +   │
                   │ Auth + Realtime  │
                   │ + Storage)       │
                   └──────────────────┘
```

## 2. Core Architectural Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Rendering | CSR-dominant SPA; App Router used for route handlers + the single shell page | The grid is stateful and realtime; SSR buys nothing past the shell. `ssr: false` dynamic imports for all modules. |
| Module isolation | Each module = folder with own components, store, hooks, theme, types | Modules must be deletable/replaceable without touching siblings. The only contract is `ModuleDefinition`. |
| Module loading | `next/dynamic` per module, loaded after kernel paint, priority-ordered | First paint shows the 9-cell skeleton grid in <1s; modules hydrate in waves (visible-critical first: Swap, Radar, Perps). |
| Client state | Zustand — one store per module + one kernel store | Independent state per module is a hard requirement. Zustand stores are cheap, isolated, devtools-friendly. |
| Server/async state | TanStack Query with per-module query-key namespaces | Caching, polling intervals, retry, and websocket cache-patching per module. |
| Cross-module comms | Typed event bus (`mitt`-style, custom typed wrapper) | Modules never import each other. Radar emits `token:inspect`; Swap and Oracle subscribe. |
| Auth | Sign-In With Solana (SIWS) → Supabase JWT | Wallet *is* identity. No email/password anywhere. |
| Persistence | Supabase (Postgres + RLS + Realtime + Storage) | Signal needs realtime; Forge needs job rows; RLS maps cleanly to wallet-scoped data. |
| AI | Vercel AI SDK + Claude (claude-fable-5 for Forge audits, claude-sonnet-4-6 for Oracle chat) | Streaming UI out of the box; tool-use for Oracle's on-chain lookups. |
| RPC | Helius (primary) + fallback rotation, all proxied through `/api/rpc` | One websocket multiplexed across modules via ConnectionManager; key stays server-side. |

## 3. The Kernel

The kernel is ~5% of the code and 100% of the cohesion. It owns:

### 3.1 LayoutEngine
- CSS Grid `grid-template: repeat(3, 1fr) / repeat(3, 1fr)` on a `100dvh` container. No page scroll ever; modules scroll internally.
- **Three module states:** `ambient` (resting cell), `hover` (cell scales to 1.02, density layer fades in, siblings dim 8%), `focus` (module animates to full viewport via Framer Motion `layoutId`; other 8 collapse into a 64px dock strip on the left edge — Arc Browser sidebar style).
- Focus mode keeps the dock interactive: dock icons show live micro-status (Perps PnL tint, Signal unread badge, Radar spike pulse) and click/`1–9` swaps focus without returning to grid.
- Grid state machine: `grid → focus(n) → grid` and `focus(n) → focus(m)` direct transitions. All transitions < 250ms.

### 3.2 HotkeyManager
Three scopes, strictly layered: `global` (always), `grid` (grid view only), `module` (focused module only). Modules register their keymap in their `ModuleDefinition`; the manager handles conflicts, displays the cheat-sheet overlay (`?`), and suspends module scopes when the command palette is open. Full map in [doc 05](05-design-system.md).

### 3.3 EventBus
Typed pub/sub. Canonical events:

```ts
type TekEvents = {
  'token:inspect':   { mint: string; source: ModuleId };       // Radar → Swap/Oracle
  'token:swap':      { inputMint: string; outputMint: string; amountUi?: number };
  'token:burn':      { mint: string };                          // anywhere → Incinerator
  'tx:submitted':    { signature: string; module: ModuleId; label: string };
  'tx:confirmed':    { signature: string; module: ModuleId };
  'oracle:ask':      { prompt: string; context?: OracleContext }; // any module → Oracle
  'wallet:changed':  { pubkey: string | null };
  'module:focus':    { id: ModuleId | null };
  'signal:received': { from: string; preview: string };
}
```

This is what makes TEK feel like an OS instead of 9 iframes: right-click any mint anywhere → context menu: *Swap · Burn · Ask Oracle · Watch on Radar · Message deployer*.

### 3.4 ConnectionManager
Single Helius websocket, reference-counted subscriptions. Modules request `accountSubscribe`/`logsSubscribe`/`programSubscribe` through it; it dedupes (Radar and Perps both watching the same account = one subscription), handles reconnect with exponential backoff, and replays subscriptions after reconnect. Status surfaced in the OS status bar (latency, slot height, TPS).

### 3.5 ToastOS + TxTracker
Every transaction from any module flows through one tracker: build → simulate → sign → send → confirm, with a unified bottom-right "process monitor" showing in-flight txs across all modules (like an OS task manager). Failures show parsed program logs, not raw hex.

## 4. Module Contract

Every module exports exactly one object:

```ts
interface ModuleDefinition {
  id: ModuleId;                          // 'launchpad' | 'swap' | ...
  slot: 1|2|3|4|5|6|7|8|9;               // default grid position
  title: string;
  glyph: ReactNode;                       // dock icon
  theme: ModuleTheme;                     // colors, fonts, texture — doc 05
  Ambient: ComponentType;                 // resting cell view (info-dense summary)
  Focused: LazyExoticComponent<ComponentType>; // full app, code-split
  hotkeys?: ModuleHotkey[];               // module-scope bindings
  commands?: PaletteCommand[];            // ⌘K entries
  statusBadge?: () => StatusBadge | null; // dock micro-status
  onEvent?: Partial<TekEventHandlers>;    // bus subscriptions
}
```

Key insight: **Ambient and Focused are different components**, not one component at two sizes. The ambient view is a purpose-built dense dashboard (Bloomberg panel); the focused view is the full application. Hover state renders Ambient with a `density="expanded"` context flag that reveals secondary stats and sparklines.

## 5. Data Flow Patterns

| Pattern | Used by | Mechanism |
| --- | --- | --- |
| Poll + cache | Swap quotes (800ms while active), Radar trending (15s), token prices (5s) | TanStack Query `refetchInterval`, paused when module ambient + not visible |
| Websocket push | Perps orderbook/positions, Radar volume spikes, wallet balance, Signal inbox | ConnectionManager / Drift WS / Supabase Realtime → `queryClient.setQueryData` patches |
| Stream | Oracle answers, Forge audit progress | Vercel AI SDK `streamText` over SSE |
| Job + poll | Forge repo analysis (30s–5min) | POST creates `forge_jobs` row → background worker → Supabase Realtime row updates drive progress UI |
| Optimistic | Signal send, Incinerator burn list, watchlist edits | Zustand optimistic write → reconcile on confirmation |

## 6. Performance Budget

- **First paint of grid shell:** < 1.0s (shell + kernel ≈ 90KB gz; modules excluded)
- **All 9 ambient views hydrated:** < 3.5s on cable
- **Focus transition:** < 250ms, 60fps (transform/opacity only; module content pre-mounted for the 3 most-recently-used modules, others mount on first focus)
- Each module's Focused bundle ≤ 250KB gz (Perps gets a 400KB exception for Drift SDK)
- Ambient views must render meaningfully **without wallet connection** (public data); wallet-dependent regions show connect affordances

## 7. Security Posture

- All third-party API keys server-side only; `/api/*` proxies are rate-limited per wallet/IP (Upstash)
- Client builds and simulates every transaction before requesting signature; simulation diff (balance changes, account closures) shown in a unified pre-sign review sheet — **no blind signing anywhere in TEK**
- SIWS nonce flow for auth; JWTs are short-lived (1h), refresh on wallet activity
- RLS on every table; the server never trusts a wallet address from a request body — only from the verified JWT
- ShadowSwap: see compliance notes in [doc 04 §5](04-solana-integrations.md)
- Forge clones untrusted repos: analysis runs in isolated containers (no network egress except the AI API), never executes repo code, hard timeouts
