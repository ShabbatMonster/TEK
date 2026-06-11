# 08 — Technical Roadmap

Six phases. Each phase ships something usable; the grid is never half-dead — modules not yet built render as styled "MODULE OFFLINE" cells with their identity already applied (the chaos looks intentional from day one).

## Phase 0 — Kernel Bootstrap (Week 1–2)
**Goal: the OS exists and feels right with zero real modules.**
- Next.js 15 + TS strict + Tailwind v4 + shadcn init; kernel tokens
- GridEngine: 3×3, hover states, focus morph, FocusDock, all at 60fps
- HotkeyManager (`1–9`, `Esc`, `⌘K`, `?`), CommandPalette shell
- Wallet adapter + WalletPill + `/api/rpc` proxy + ConnectionManager
- StatusBar with live slot/TPS; 9 themed placeholder cells
- **Exit criteria:** grid↔focus under 250ms; keyboard-only navigation complete; Lighthouse perf ≥ 90

## Phase 1 — First Blood: Swap · Incinerator · Radar-lite (Week 3–5)
**Goal: three genuinely useful modules; the cross-module story demos.**
- Swap: full Jupiter integration, PreSignSheet + SimDiff, RouteVisualizer
- Incinerator: scan/classify/burn/close pipeline, hold-to-burn, multi-tx queue
- Radar-lite: trending tab + token inspector (no alerts/websockets yet)
- TxTracker + ToastOS end-to-end; EventBus with `token:inspect`/`token:swap`/`token:burn`; right-click context menu
- SIWS auth + Supabase + `users`/`user_settings`/`burn_history`
- **Exit criteria:** Radar → right-click token → Swap flow works; a stranger reclaims rent successfully on mainnet

## Phase 2 — Intelligence: Oracle · Forge (Week 6–9)
- Oracle: AI SDK chat, all 6 tools, context chips, sessions persistence, ambient Eye
- Forge: job pipeline (worker deploy on Fly.io), analyzer passes, report UI, share pages
- RAG corpus build (Solana/Anchor/SPL docs → pgvector)
- Cross-pollination: Oracle `getForgeReport` tool; "Ask Oracle" context-menu everywhere
- **Exit criteria:** Oracle correctly explains 9/10 random mainnet txs; Forge audits a known-rugged repo and flags it

## Phase 3 — Degen Stack: Launchpad · Radar-full (Week 10–12)
- Launchpad: PumpPortal integration, IPFS pipeline, wizard + console, launches table
- Radar-full: spike-detection cron + Redis baselines, alert rules, wallet watch via Helius `transactionSubscribe`, new-pairs feed with rug heuristics
- **Exit criteria:** token launched end-to-end from TEK; volume-spike alert fires < 90s after a real spike

## Phase 4 — Heavy Metal: Perps · Signal (Week 13–16)
- Perps: Drift SDK, DLOB orderbook (canvas ladder), order ticket with liq preview, positions/health; ambient PnL strip
- Signal: three message lanes (memo / offchain / E2E), Helius webhook indexer for memos, inbox realtime, .sol resolution, requests tray
- **Exit criteria:** open/close a Drift position entirely in TEK; two wallets exchange E2E messages; memo from a non-TEK wallet appears in inbox

## Phase 5 — Shadow & Polish (Week 17–20)
- ShadowSwap: privacy audit + fresh-address tooling first; Privacy Cash vendored client (reviewed commit) + web-worker prover; Token-2022 confidential transfers; geo-fencing
- All signature microinteractions finished; reduced-motion pass; a11y audit
- Performance hardening: bundle budgets enforced in CI, polling governor tuning
- Monetization switches on (doc 09): Jupiter referral, launch fee, pro tier
- **Exit criteria:** full 9/9 grid live on mainnet; p95 interaction latency < 100ms; security review of tx pipeline + ShadowSwap complete

## Ongoing / Post-launch
- TEK relayer for ShadowSwap withdraws
- Layout editor (drag modules between slots — schema already supports `grid_layout`)
- Module SDK: third-party modules as the 10th-slot marketplace (long-term moat)
- Mobile companion mode hardening

## Risk Register (top 5)

| Risk | Mitigation |
| --- | --- |
| pump.fun/PumpPortal API churn | `LaunchProvider` abstraction + direct-program fallback path (doc 04 §2.1) |
| Drift SDK bundle weight & complexity | isolated chunk, digested-state mirror, DLOB-only read path works without SDK |
| Privacy regulatory shift | ShadowSwap panels feature-flagged individually; ops-privacy tooling is unaffected core |
| Rate-limit costs at scale (Helius/Birdeye) | polling governor, edge caching, per-wallet quotas, tier-gating refresh rates |
| 9 modules = scope explosion | phase gates above; a module ships only when its exit criteria pass — "MODULE OFFLINE" cells are acceptable in prod |
