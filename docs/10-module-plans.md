# 10 — Module Implementation Plans

Per-module build plans. Common scaffold for each (not repeated below): create folder from template (`Ambient.tsx`, `Focused.tsx`, `store.ts`, `queries.ts`, `theme.css`, `index.ts`), register in `modules/registry.ts`, wire hotkeys + palette commands + bus handlers in the ModuleDefinition.

---

## 1 · LAUNCHPAD — slot 1

**Build order**
1. `LaunchProvider` interface + PumpPortal impl (`trade-local` create); metadata builder (name/symbol/desc/socials → pump-spec JSON)
2. `/api/launchpad/ipfs` — multer-style upload → sharp re-encode (strip EXIF, cap 1MB, square crop server-verified) → pin (pump IPFS, Pinata fallback) → return URI
3. Wizard state machine in store: `identity → image → economics → arming → launching → live`; each step keyboard-completable (`Tab`/`↵`)
4. LaunchPreviewCard — renders the token exactly as pump.fun will show it, live as you type (the conversion moment)
5. Launch execution: pin metadata → build create(+dev-buy) tx → PreSignSheet → send → `LaunchConsole` TerminalFeed streams each stage → insert `launches` row
6. Post-launch: bonding-curve account subscription → progress bar to graduation; `bonded` status flip
7. Ambient: live feed of *all* pump.fun creates (Helius `logsSubscribe` on pump program, throttled to 2 rows/s) + user's launches strip + the armed LAUNCH button

**Edge cases:** image pin succeeds but tx fails (orphan pin — GC weekly); symbol collisions (warn, don't block); dev-buy slippage on instant snipes (default 10% slippage on create-buy, surfaced).
**Done when:** stranger launches a token in < 90 seconds from cold load; failure at any stage leaves a resumable wizard, never a half-launched ghost.

---

## 2 · SWAP — slot 2

**Build order**
1. Token list query + `<TokenCombobox/>` (fuzzy over 20k tokens, virtualized, recents + balances pinned to top)
2. Quote loop: 800ms re-quote keyed on (in, out, amount, slippage); quote-age ring; `phase` machine `idle → quoting → reviewing → sending`
3. Swap execution via Jupiter `/swap` → local re-simulation → PreSignSheet (SimDiff shows exact balance deltas + fee) → send/confirm → invalidate `['wallet','balances']`
4. RouteVisualizer: parse `routePlan` → DAG with AMM labels + split %, animated flow dots
5. PairChart: Birdeye OHLCV → lightweight-charts; syncs to selected pair
6. Ambient QuickSwap: last pair, amount input, big rate readout, one-keystroke re-quote (`R`); PriceTape marquee of watchlist
7. Hotkeys: `F` flip, `⌘↵` execute, `1/2/5` quick-amount chips

**Edge cases:** token-2022 transfer-fee tokens (show fee-adjusted receive amount); quote expiry mid-review (auto-requote, flash diff if worse); wrapped SOL handling (auto wrap/unwrap toggle).
**Done when:** quote-to-confirmed under 8s p50 in `fast` fee mode; price-impact > 3% requires explicit acknowledgment.

---

## 3 · SHADOWSWAP — slot 3

**Build order** (privacy value ships incrementally — see roadmap phase 5)
1. **PrivacyAudit first** (pure read): linkability report — address-reuse score, CEX-linked counterparties (tag list), dust-attack detector (sub-1000-lamport inbound spam), timing-pattern note; renders as a "surveillance report" with redaction aesthetics
2. Fresh-address tooling: derive burner receive addresses (standard derivation, clearly explained), sweep planner
3. Encrypted local vault: IndexedDB + AES-GCM (key = HKDF of a dedicated wallet-signed message); stores shielded-pool notes; lock/unlock UX; export/import encrypted backup file with violent "loss = funds gone" warnings
4. Privacy Cash integration: vendor client + circuits from [Privacy-Cash/privacy-cash](https://github.com/Privacy-Cash/privacy-cash) at pinned reviewed commit; proof generation in `prover.worker.ts` (WASM, off main thread, progress events); shield (deposit) → note to vault; unshield (withdraw via relayer) to arbitrary address
5. Token-2022 confidential transfer panel: detect CT-extension mints, configure account, deposit→encrypt, confidential transfer, withdraw→decrypt flows
6. Theme work: `ScrambleText` everywhere, redacted-by-default amounts, encrypt-cascade animation on shield
7. Compliance: geo-fence flag per panel (Vercel edge geo), audit-status banner, ToS gate on first shield

**Edge cases:** prover OOM on low-end devices (chunked proving + warning); relayer down (queue withdraw intent locally, retry); vault key signature mismatch after wallet migration (recovery via backup file only — document loudly).
**Done when:** full shield→unshield round-trip on mainnet with deposit/withdraw link unobservable on-chain; vault survives reload/reconnect; panels 1–2 usable even if pool integration is flagged off.

---

## 4 · INCINERATOR — slot 4

**Build order**
1. Scanner: `getTokenAccountsByOwner` + DAS assets → classifier (empty / dust < $0.01 / spam via `token_registry.spam_score` + heuristics / NFT / frozen) → `ScanResults` DataGrid with classification chips
2. Burn cart: selection set in store joins scan results; running totals — accounts, tokens burned, **SOL reclaimed** (the hero number)
3. Tx builder: per account `burnChecked` (if balance > 0) + `closeAccount`; Metaplex `burnV1` for NFTs; CU-simulate to pack ≤ ~24 ops/tx; multi-tx queue with per-tx progress and partial-failure recovery (completed accounts drop from cart)
4. Safety: SimDiff must show *only* expected closures; any token with value > $1 in selection → type symbol to confirm; frozen accounts visible but unselectable with explainer
5. Hold-to-burn IgniteButton (3s, flame fill, ember particles, haptic-style shake on completion) + slot-machine reclaim counter
6. Ambient: scan on wallet connect (cached 5min) → "0.847 SOL reclaimable" hero + dust count + FlameMeter (lifetime burned, from `burn_history`)
7. Bus: `token:burn` handler pre-selects that mint's accounts and focuses module

**Edge cases:** ATAs that are also Token-2022 with extensions (separate ix variants); accounts receiving dust *during* the burn session (re-scan diff, don't double-close); rent destination ≠ owner (never — hardcode owner).
**Done when:** 200-account wallet cleans up in ≤ 9 txs with one hold gesture; impossible to burn anything valuable without typed confirmation.

---

## 5 · RADAR — slot 5

**Build order**
1. `/api/radar/trending` — Birdeye + DexScreener merge, dedupe by mint, edge-cache 15s → TrendingGrid dense cards (price, 1h/24h Δ, vol, liq, holder count, sparkline)
2. TokenInspector drawer: full intel sheet (authorities, top holders %, LP status, age, socials) + rug-heuristic flags; right-click/context-menu source everywhere
3. Spike engine (server): 1-min Vercel cron → hot universe (trending ∪ watchlisted) → 5m/1h vol vs trailing baselines in Upstash Redis → breach inserts `alert_events` → Supabase Realtime → SpikeFeed + ToastOS
4. AlertRuleBuilder: rule type + params form → `alert_rules`; channels toast/Signal/webhook(tier-gated)
5. Wallet watch: per-watched-wallet Helius `transactionSubscribe` through ConnectionManager; enhanced-parse render ("bought 4.2M BONK · Raydium · $1.2k")
6. New pairs: server `logsSubscribe` Raydium/pump initialize events → heuristic pre-filter (mint authority, holder concentration, LP lock) → feed with risk chips
7. Ambient SweepScope: radial canvas — blips = trending tokens (r = recency, size = mcap, color = Δ); 4s sweep; spike = cell pulse + amber ping

**Edge cases:** Birdeye rate limits (cache + tier-gated refresh); baseline cold-start (suppress alerts first 2h per token); watched-wallet spam (collapse bursts > 5 tx/min into one digest row).
**Done when:** real volume spike → alert < 90s; SweepScope readable from across a room; every token everywhere right-clicks into the Inspector.

---

## 6 · ORACLE — slot 6

**Build order**
1. `/api/oracle/chat` — AI SDK `streamText`, Claude, tier-based model/quota; system prompt (precision, address citation, risk-flagging, no-speculation)
2. Six tools (doc 04 §2.6) — each pre-digests raw chain data into compact typed summaries *before* the model sees it (token efficiency + accuracy); `ToolCallCard` renders live tool activity
3. ChatThread: streamed markdown, syntax-highlighted code, address/sig components that hook the kernel context menu (Oracle's answers are themselves cross-module surfaces)
4. ContextChips: pin tx/wallet/token/Forge-report → pre-fetched into the first message; bus handler for `oracle:ask` (any module sends prompts with context)
5. Sessions: `oracle_sessions`/`oracle_messages` persistence, SessionRail, title auto-gen
6. PromptDeck: 8 canned power prompts ("explain this tx like I'm rushed", "is this wallet a bot?", "what does this program do?")
7. Ambient: the Eye (idle/dilate/spin/glance states driven by bus traffic) + LastInsight one-liner + AskBar (`⌘/` global focus → submit focuses module with prompt carried over)
8. RAG: docs corpus → chunk → pgvector; `searchDocs` tool

**Edge cases:** tool timeout mid-stream (model continues with partial-data disclosure); user pastes a 5k-line program dump (pre-truncate with notice); hallucinated addresses (post-process: any address in output not present in tool results gets flagged ⚠ unverified).
**Done when:** explains 9/10 random mainnet txs correctly (human-judged); tool round-trip p50 < 2.5s; the Eye makes people ask "what is that."

---

## 7 · FORGE — slot 7

**Build order**
1. Worker service (`workers/forge-analyzer`, Fly.io): poll `forge_jobs` → shallow-clone (depth 1, 100MB cap, no submodules, **no code execution**, container w/o network egress except AI API) → static passes → AI passes → write report + findings + artifact → status updates stream to `progress_log`
2. Static passes: language/LOC breakdown, dependency manifest parse + known-vuln lookup (OSV), commit-history stats (age, cadence, bus-factor), license detect, secret-pattern scan, **Solana-specific red flags** (authority retention patterns, upgradeable-program notes, honeypot transfer hooks, fake-LP-lock patterns in scripts)
3. AI passes (claude-fable-5): architecture summary; per-flagged-file deep read (capped 40 files, prioritized by static-pass risk); claim-vs-code check (README promises vs implementation); composite scoring rubric → `grades` {security, quality, activity, docs, decentralization}
4. RepoIntake: URL paste → GitHub API metadata preview (stars, age, last push) → cost/quota check → enqueue
5. AuditProgress: TerminalFeed bound to `forge:{job_id}` realtime — clone/tree/deps/AI stages with spark-on-complete
6. ReportView: ScoreHeader (0–100 + grade + radar chart), RedFlagBanner (criticals first), FindingsList grouped by severity with `file:line` deep links to GitHub, FileTreeHeat
7. Share: `share_slug` → `/r/[slug]` public page (OG image with score — the viral surface)
8. Ambient: last score gauge + queue status + compact RepoInput (paste → enqueue without focusing)

**Edge cases:** monorepos (analyze dominant package, note scope); private repos (Pro: user-supplied fine-grained PAT, used in-worker only, never stored beyond job); 0-commit/fork-only repos (score caps with "fork shell" flag); AI cost runaway (per-job token budget, hard stop + partial report).
**Done when:** known-good repo scores > 80, known rug scores < 30 with the actual rug vector named in findings; full audit p50 < 3min for a typical repo.

---

## 8 · PERPS — slot 8

**Build order**
1. Read path first (no wallet): DLOB websocket → orderbook state; market accounts via ConnectionManager → mark/index/funding/OI; MarketHeader + market selector
2. OrderbookLadder: canvas-rendered (DOM can't hold 60fps here) — depth bars, grouped price levels, 90ms update flash, click-price → ticket, mid-spread readout
3. TradingViewPane: lightweight-charts with mark-price line; later: position-entry + liq-price overlays
4. Drift write path: lazy-init `DriftClient` on first trade intent; `initializeUserAccount` framed as onboarding step with rent disclosure; deposit/withdraw collateral sheet
5. OrderTicket: market/limit/post-only/reduce-only; leverage slider; margin + **liq-price preview computed via SDK math before placing** (the safety feature); `B`/`S` hotkeys; ⌘↵ submit through PreSignSheet
6. Positions/Orders/Fills tabs (DataGrid) — ws-patched, zero polling; close/modify/cancel inline; AccountHealthBar with liq-proximity color ramp
7. Ambient PositionStrip: live uPnL per position + cell border PnL tint (the module that makes the whole grid feel alive) + 4-market mark grid
8. Funding tab + funding countdown in header

**Edge cases:** DLOB disconnect (book greys out + staleness stamp — never show a stale book as live); account below maintenance margin (full-module red wash + deleverage CTA); SDK/chain state divergence (SDK subscription is truth, force-refresh control exposed).
**Done when:** order placement p50 < 3s from `⌘↵`; ladder sustains 60fps through a volatility burst; liq preview within 1% of Drift UI's number.

---

## 9 · SIGNAL — slot 9

**Build order**
1. Schema + RLS (doc 03) + ThreadList/ThreadView/Composer with `thread_key` convention
2. Off-chain plaintext lane: insert + Supabase Realtime delivery; optimistic send; read receipts (`read_at`)
3. On-chain memo lane: Memo ix + 0-lamport transfer → PreSignSheet → Helius webhook (`/api/signal/webhook`) indexes inbound memos for *any* registered wallet → rows with `tx_signature` + chain-link seal badge
4. E2E lane: per-conversation key — both parties derive x25519 keypair from a wallet-signed derivation message (deterministic, never touches the wallet's actual signing key); `tweetnacl.box` seal/open; ciphertext-only storage; lock icon + "server can't read this" affordance
5. NewMessageModal: any address, SNS .sol resolution, ENS-style avatar fallback; messaging a non-TEK wallet explained inline (off-chain waits, on-chain lands regardless)
6. Requests tray: threads from unknown senders quarantined; min-balance filter option; block list
7. Ambient: 3-line InboxPreview + pink unread badge + ComposeQuick; pager-buzz on receive (realtime subscription lives at module registration, active even when never focused)
8. BroadcastView: public memos from/to the connected wallet as a feed; bus handler `signal:compose` (context menu "Message owner" from any wallet address anywhere)

**Edge cases:** both parties must have derived keys before E2E works (handshake state: invite → accept → derive → ready, with plaintext fallback offer); memo size > 566 bytes (split or force off-chain); webhook replay/dupes (unique on `tx_signature`).
**Done when:** TEK→TEK round-trip < 1s off-chain; memo from a raw CLI wallet appears in inbox < 30s; E2E verified by reading the DB and seeing only ciphertext.

---

## Cross-Module Definition of Done (applies to all 9)

- Ambient view renders real data without wallet connection where possible
- All interactive paths keyboard-reachable; module hotkeys registered + in cheat sheet
- Every tx through the shared pipeline (PreSignSheet, TxTracker) — zero bespoke signing
- `reset()` correct on wallet change; no cross-wallet data bleed (test: switch wallets, audit every visible number)
- Error boundary verified: kill the module's API → themed SEGFAULT card, 8 siblings unaffected
- Bundle ≤ 250KB gz (Perps 400KB); polling governed by visibility
