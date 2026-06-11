# 06 — Folder Structure

```
tek/
├─ app/
│  ├─ layout.tsx                    # fonts, providers, metadata
│  ├─ page.tsx                      # THE page — renders <TekKernel/>
│  ├─ globals.css                   # kernel tokens, Tailwind v4 @theme
│  ├─ r/[slug]/page.tsx             # public Forge report share pages (only other route)
│  └─ api/
│     ├─ rpc/route.ts               # Helius proxy (Edge)
│     ├─ rpc/ws-ticket/route.ts
│     ├─ auth/{nonce,verify}/route.ts
│     ├─ launchpad/ipfs/route.ts
│     ├─ radar/{trending,intel}/route.ts
│     ├─ oracle/chat/route.ts       # AI SDK stream
│     ├─ forge/{jobs,reports}/route.ts
│     └─ cron/{spikes,registry}/route.ts   # Vercel cron entries
│
├─ kernel/                          # the OS layer — modules may import this
│  ├─ TekKernel.tsx
│  ├─ grid/{GridEngine,ModuleCell,FocusDock,ModuleChrome}.tsx
│  ├─ bus/{events.ts,useBus.ts}     # typed event definitions + hooks
│  ├─ hotkeys/{HotkeyManager.tsx,registry.ts,CheatSheet.tsx}
│  ├─ palette/CommandPalette.tsx
│  ├─ context-menu/ContextMenuLayer.tsx
│  ├─ tx/{TxTracker.tsx,PreSignSheet.tsx,ToastOS.tsx}
│  ├─ connection/ConnectionManager.ts
│  ├─ chrome/{StatusBar,WalletPill,SlotClock,PriorityFeeDial}.tsx
│  ├─ theme/{ThemeBridge.tsx,module-themes.ts}
│  └─ store/kernel.store.ts         # layout, focus, fee preset, tx queue
│
├─ modules/                         # ★ one folder per module, identical shape
│  ├─ registry.ts                   # ModuleDefinition[] — the only file that knows all 9
│  ├─ types.ts                      # ModuleDefinition, ModuleTheme contracts
│  ├─ launchpad/
│  │  ├─ index.ts                   # exports its ModuleDefinition
│  │  ├─ Ambient.tsx
│  │  ├─ Focused.tsx                # lazy entry — imports ./components/*
│  │  ├─ components/                # LaunchWizard, LaunchConsole, ...
│  │  ├─ store.ts                   # zustand — this module ONLY
│  │  ├─ queries.ts                 # TanStack hooks, keys namespaced 'launchpad/*'
│  │  ├─ lib/                       # pumpportal client, metadata builder
│  │  └─ theme.css                  # [data-module='launchpad'] vars
│  ├─ swap/            …same shape
│  ├─ shadowswap/      …same shape (+ worker/prover.worker.ts)
│  ├─ incinerator/     …same shape
│  ├─ radar/           …same shape
│  ├─ oracle/          …same shape
│  ├─ forge/           …same shape
│  ├─ perps/           …same shape (+ lib/drift.ts heavy client)
│  └─ signal/          …same shape (+ lib/crypto.ts e2e helpers)
│
├─ components/
│  ├─ ui/                           # shadcn primitives (restyled)
│  └─ tek/                          # TokenIcon, DataGrid, DeltaNumber, Sparkline,
│                                   # AmountInput, Address, TerminalFeed, ScrambleText…
│
├─ lib/
│  ├─ solana/{tx.ts,connection.ts,siws.ts,parse.ts}
│  ├─ providers/                    # LaunchProvider, SwapProvider, PerpsProvider,
│  │                                # IntelProvider, PrivacyProvider + impls
│  ├─ supabase/{client.ts,server.ts,types.gen.ts}
│  ├─ ai/{tools.ts,prompts/}
│  └─ utils/{format.ts,bn.ts}
│
├─ workers/                         # Forge analyzer (separate deploy — Fly.io/Railway)
│  └─ forge-analyzer/{index.ts,passes/,Dockerfile}
│
├─ supabase/
│  ├─ migrations/                   # SQL from doc 03
│  └─ seed.sql
│
├─ public/fonts/                    # self-hosted module display fonts
├─ e2e/                             # Playwright: grid, focus, hotkeys, swap happy-path
├─ tailwind.config.ts  tsconfig.json  next.config.mjs
└─ .eslintrc — incl. no-restricted-imports: modules/* cannot import modules/*
```

**Conventions**
- A module folder is a sealed unit: delete `modules/forge/` + its line in `registry.ts` and TEK still compiles
- `registry.ts` is the single composition point — also where slot order and load priority live
- Query-key namespace = folder name (`['perps', 'positions', wallet]`) — enables per-module cache invalidation on wallet change
- Server-only code in modules lives in their `lib/` but is imported solely by `app/api/*` routes (enforced with `server-only` package)
