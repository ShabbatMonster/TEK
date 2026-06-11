# TEK — The Everything Kernel

> A single-page Solana operating system. Nine applications. One viewport. Zero scrolling.

TEK is a modular crypto workstation rendered as a 3×3 grid that occupies the entire desktop viewport. Each cell is a fully independent mini-application with its own visual identity, state, and Solana integrations — unified by a shared kernel that handles wallet, layout, keyboard control, and inter-module messaging.

**Design philosophy:** Bloomberg Terminal × Arc Browser. Cyberpunk OS. Organized chaos. Dense but beautiful.

```
┌─────────────┬─────────────┬─────────────┐
│ 1 LAUNCHPAD │   2 SWAP    │ 3 SHADOWSWAP│
│ token forge │ jupiter agg │ private swap│
├─────────────┼─────────────┼─────────────┤
│4 INCINERATOR│   5 RADAR   │  6 ORACLE   │
│ burn/reclaim│ token intel │ AI assistant│
├─────────────┼─────────────┼─────────────┤
│   7 FORGE   │   8 PERPS   │  9 SIGNAL   │
│ repo auditor│ drift trade │ wallet msgs │
└─────────────┴─────────────┴─────────────┘
```

## Documentation

| Doc | Contents |
| --- | --- |
| [01 — Product Architecture](docs/01-architecture.md) | System overview, kernel design, data flow, infra |
| [02 — Component Hierarchy](docs/02-components.md) | Full React component tree, module shell contract |
| [03 — Database Schema](docs/03-database.md) | Postgres/Supabase schema, RLS, realtime channels |
| [04 — Solana Integrations](docs/04-solana-integrations.md) | Wallet adapter, Jupiter, pump.fun, Drift, Helius, Token-2022 |
| [05 — UI/UX System](docs/05-design-system.md) | Kernel design tokens, 9 module identities, motion, keyboard map |
| [06 — Folder Structure](docs/06-folder-structure.md) | Complete repo layout |
| [07 — State Management](docs/07-state-management.md) | Zustand-per-module, kernel store, event bus, TanStack Query |
| [08 — Technical Roadmap](docs/08-roadmap.md) | Phases 0–5 with exit criteria |
| [09 — Monetization](docs/09-monetization.md) | Fee capture, subscriptions, token design |
| [10 — Module Implementation Plans](docs/10-module-plans.md) | Detailed build plan for all 9 modules |

## Running

```bash
npm install --legacy-peer-deps
cp .env.example .env.local   # optional: RPC override + ANTHROPIC_API_KEY for Oracle/Forge AI
npm run dev                  # http://localhost:3000
```

Works with no env at all: defaults to the public mainnet RPC (rate-limited — a Helius key in `NEXT_PUBLIC_RPC_URL` is strongly recommended). Swap, Radar, Perps, Forge run on public APIs; Oracle's AI lane needs `ANTHROPIC_API_KEY`.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui · Zustand · TanStack Query · Framer Motion · Solana Wallet Adapter · Helius RPC/WS · Jupiter v6 · PumpPortal · Drift SDK · Supabase · Vercel AI SDK (Claude)

## The Kernel Concept

The "kernel" is the thin layer every module plugs into:

- **Wallet** — one connection, shared by all 9 modules
- **Layout** — grid ↔ focus-mode transitions, hover expansion
- **Hotkeys** — `1–9` focus, `Esc` grid, `⌘K` command palette, module-scoped keys
- **Bus** — typed pub/sub so modules compose (Radar finds a token → Swap quotes it → Oracle explains it)
- **Theme** — shared spacing/motion/radius primitives; per-module color, type, and texture
