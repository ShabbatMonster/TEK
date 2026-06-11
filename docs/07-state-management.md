# 07 — State Management Design

## 1. The Four Layers

| Layer | Tool | Owns | Never holds |
| --- | --- | --- | --- |
| **Kernel store** | Zustand (`kernel/store`) | focus state, hover state, fee preset, tx queue, palette open, hotkey scope | module business state |
| **Module stores** | Zustand × 9, one per module folder | UI state + workflow state of that module only | other modules' state, server data |
| **Server/chain cache** | TanStack Query | everything fetched: balances, quotes, positions, trending, reports | UI state |
| **Bus** | typed mitt | transient cross-module intents | anything persistent (fire-and-forget only) |

Rule of thumb: *if it came over the network it's Query; if it's what the user is doing it's a module store; if it's where things are on screen it's the kernel store; if it's a message between modules it's the bus.*

## 2. Kernel Store

```ts
interface KernelStore {
  focused: ModuleId | null;
  hovered: ModuleId | null;
  recentFocus: ModuleId[];            // MRU — keeps top-3 Focused views mounted
  feePreset: 'eco' | 'fast' | 'turbo';
  txQueue: TrackedTx[];               // cross-module process monitor
  paletteOpen: boolean;
  hotkeyScope: 'global' | 'grid' | ModuleId;
  focus(id: ModuleId | null): void;   // drives GridEngine state machine
  trackTx(tx: TrackedTx): void;
}
```

## 3. Module Store Pattern

Every module follows the same skeleton — illustrated with Swap:

```ts
// modules/swap/store.ts
interface SwapStore {
  // workflow state
  inputMint: string; outputMint: string;
  amountRaw: string;                   // string, never float
  slippageBps: number | 'dynamic';
  phase: 'idle' | 'quoting' | 'reviewing' | 'sending';
  // ui state
  chartPair: string | null;
  // actions
  setPair(a: string, b: string): void;
  flip(): void;
  reset(): void;                       // called on wallet:changed
}
export const useSwapStore = create<SwapStore>()(
  devtools(persist(immer(creator), {
    name: 'tek:swap',
    partialize: s => ({ inputMint: s.inputMint, outputMint: s.outputMint,
                        slippageBps: s.slippageBps }),   // persist prefs, not workflow
  }))
);
```

Conventions:
- `devtools` named per store → 10 inspectable stores in Redux DevTools
- `persist` with explicit `partialize` — preferences survive reload, in-flight workflow never does
- Every store implements `reset()`; the kernel calls all resets on `wallet:changed` via a registration list (stores self-register at module load)
- Amounts are strings/BN end-to-end; floats only at the formatting boundary

## 4. Server State — TanStack Query Topology

```ts
// namespaced keys, per-module file
['swap', 'quote', inMint, outMint, amount, slippage]   // refetchInterval: 800, enabled: phase!=='idle'
['swap', 'tokenlist']                                  // staleTime: 1h
['wallet', 'balances', pubkey]                         // shared key — Swap, Incinerator, Perps all read it
['perps', 'positions', pubkey]                         // ws-patched, no polling
['radar', 'trending']                                  // refetchInterval: 15s, pauses when tab hidden
['forge', 'job', jobId]                                // realtime-patched
['oracle', 'session', id]
```

- **Shared chain facts** (`['wallet', ...]`, `['token', mint]`) live in a neutral namespace so modules converge on one cache entry — Incinerator's burn invalidates `['wallet','balances']` and Swap's MAX button updates instantly. This is deliberate cross-module cohesion *through the cache*, not through stores.
- **Websocket → cache:** ConnectionManager and Drift/Supabase subscriptions call `queryClient.setQueryData` — components never subscribe to sockets directly. One mental model: *Query cache is the single source of async truth; sockets are just a faster fetch.*
- **Polling discipline:** every `refetchInterval` is wrapped in `useVisiblePolling(moduleId, interval)` — full rate when module is focused or hovered, 4× slower when ambient, paused when tab hidden. Nine modules polling naively would melt rate limits; this is the governor.

## 5. The Bus (transient layer)

```ts
bus.emit('token:inspect', { mint, source: 'radar' });

// modules/swap/index.ts — in ModuleDefinition
onEvent: {
  'token:swap': ({ inputMint, outputMint, amountUi }) => {
    useSwapStore.getState().setPair(inputMint ?? SOL, outputMint);
    useKernelStore.getState().focus('swap');
  },
}
```

- Handlers are registered declaratively in `ModuleDefinition` — the kernel wires/unwires them; modules never call `bus.on` in components (prevents leak-prone ad-hoc listeners)
- Bus events carry **intents**, not data payloads — the receiving module fetches its own data through Query. This keeps the bus schema tiny and modules honest.

## 6. Wallet & Auth State

- Wallet adapter context is the source of truth for `publicKey`/`signTransaction`
- A thin `useWallet()` kernel wrapper adds: SIWS session status, lazy-auth trigger (`ensureSession()` — modules call before first persistence op), and emits `wallet:changed`
- On disconnect: all module `reset()`s fire, Query cache for `['wallet', ...]` + all wallet-keyed namespaces is removed (not invalidated — removed), Supabase session destroyed

## 7. Module-Specific Notes

| Module | State quirks |
| --- | --- |
| Launchpad | Wizard state machine in store (`identity → image → economics → arming → launching`); image file held in a ref outside Zustand (no File objects in stores) |
| ShadowSwap | Notes/secrets in **encrypted IndexedDB** (AES-GCM key derived from a wallet signature) — never in Zustand persist, never in Supabase; store holds only handles + lock status |
| Incinerator | Selection as `Set<string>` in store; scan results in Query; burn cart derives by joining the two — survives a re-scan without losing selection |
| Radar | Feed buffers are ring buffers (max 500 rows) in store to bound memory across a day-long session |
| Oracle | Streaming message handled by AI SDK's `useChat`; store only holds session list + context chips |
| Perps | Drift SDK keeps its own account subscription state; the module store mirrors *digested* numbers (health, PnL) — components read the mirror, never the SDK objects (keeps renders cheap + SDK swappable) |
| Signal | Unread counts maintained ambient via Supabase Realtime even when module never focused — subscription lives in the ModuleDefinition `onEvent` lifecycle, not in components |
