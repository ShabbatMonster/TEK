# 04 — Solana Integrations

## 1. Foundation Layer

### 1.1 RPC Strategy
- **Primary:** Helius (RPC + Enhanced APIs + websockets + DAS for token/NFT enumeration)
- **Fallbacks:** Triton, public mainnet (degraded mode)
- Client talks to `/api/rpc` (Edge route) which injects the key, applies per-wallet rate limits, and load-balances. Websocket connects via a short-lived signed URL minted by `/api/rpc/ws-ticket`.
- One `Connection` instance app-wide, exposed through kernel context. `confirmTransaction` via websocket signature subscription, not polling.

### 1.2 Wallet Adapter
```
@solana/wallet-adapter-react + -base + -wallets (Phantom, Solflare, Backpack, Ledger)
```
- `autoConnect` on; custom `<WalletPill/>` UI (the stock modal is restyled to kernel theme)
- **SIWS auth flow:** connect → `GET /api/auth/nonce` → wallet signs SIWS payload → `POST /api/auth/verify` → Supabase JWT with `wallet` claim. Auth is lazy: only requested the first time a module needs persistence (Signal, Oracle history, watchlists).
- Wallet change event → bus `wallet:changed` → every module store resets its wallet-scoped slices.

### 1.3 Transaction Pipeline (shared `lib/solana/tx.ts`)
All 9 modules build transactions through one pipeline:

```
buildTx(ixs, opts) → addComputeBudget(simulated CU × 1.15, priority fee from kernel dial)
                   → v0 message + LUTs where beneficial
                   → simulate() → SimDiff for PreSignSheet
                   → signTransaction (never signAllTransactions for unrelated txs)
                   → sendRawTransaction(skipPreflight: true, maxRetries: 0)
                   → rebroadcast loop every 2s until confirmed/blockhash expiry
                   → bus: tx:submitted / tx:confirmed / tx:failed (parsed logs)
```

Priority fee presets pull live percentiles from Helius `getPriorityFeeEstimate` (eco=p35, fast=p65, turbo=p90, with per-module floor overrides — Perps defaults turbo).

## 2. Module Integrations

### 2.1 Launchpad — pump.fun
No official pump.fun SDK guarantees; two integration paths, behind one interface (`LaunchProvider`):

1. **PumpPortal Local Transaction API** (primary): `POST https://pumpportal.fun/api/trade-local` with create params → returns serialized tx → client signs/sends. Metadata first: image → `POST /api/launchpad/ipfs` (server pins via pump.fun's IPFS endpoint or Pinata fallback) → metadata JSON pinned → URI into create tx.
2. **Direct program path** (fallback/v2): build `create` + optional `buy` instructions against the pump.fun bonding-curve program (`6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P`) using a vendored IDL. More work, zero third-party dependency.

Post-launch: subscribe to the bonding curve account for live progress; "bonded" status when curve completes → Raydium migration detected.

### 2.2 Swap — Jupiter
- **Quote:** `GET /quote` (v6) — re-quote every 800ms while the swap panel is hot; quote age indicator turns amber >3s, red >10s
- **Swap:** `POST /swap` with `dynamicComputeUnitLimit: true`, `dynamicSlippage`, `prioritizationFeeLamports: 'auto'`; returned tx deserialized, **re-simulated locally**, shown in PreSignSheet
- **Token list:** Jupiter token API, cached at the edge 1h, hydrates `<TokenCombobox/>` and `token_registry`
- **Price feed:** Jupiter Price API v2 for watchlist/PriceTape (5s poll)
- Referral/platform fee via Jupiter referral account (`platformFeeBps`) — see monetization
- Route data from quote response powers `<RouteVisualizer/>` (AMM hop labels, split percentages)

### 2.3 ShadowSwap — privacy stack
Three real, legal primitives compose this module (and an explicit compliance posture):

1. **Privacy Cash shielded pool** (`PrivacyProvider` interface): deposit SOL → commitment note (client-generated secret) → later withdraw to any address with a zk proof breaking the deposit↔withdraw link. Privacy Cash is **open-source** ([Privacy-Cash/privacy-cash](https://github.com/Privacy-Cash/privacy-cash)), which shapes the integration:
   - **Vendor, don't black-box:** fork/pin the client SDK and zk circuit artifacts at a reviewed commit; build proof generation into ShadowSwap's own bundle (proofs computed client-side in a web worker — the depositing browser never sends secrets anywhere)
   - **Verify ourselves:** run Forge (module 7) on the repo as dogfood; review the on-chain program against the deployed program hash before pointing mainnet funds at it
   - **Relayer choice:** use the public relayer for withdraw-gas privacy initially; roadmap option to run a TEK relayer (fee opportunity + no third-party dependency for the unlink step)
   - The pool program is theirs (deployed + audited on their side); TEK never redeploys or modifies the pool — we are a client, which keeps our surface area to UI + note management
2. **Token-2022 confidential transfers:** for mints with the confidential-transfer extension — encrypt balance, transfer with amount hidden (ElGamal + zk range proofs via `@solana/spl-token` confidential transfer helpers).
3. **Operational privacy tooling** (no new protocol risk, ships first):
   - **Privacy Audit:** linkability analysis of the connected wallet (address reuse, CEX-tagged counterparties, dusting attacks, timing patterns) — read-only Helius queries + heuristics
   - **Fresh-address workflows:** derive burner receive addresses, sweep planning
   - **Decoy-resistant defaults:** randomized delay option between shield/unshield

**Compliance notes:** geo-fence the shielded-pool panel per OFAC requirements; surface protocol audit status in-UI; never custody or relay user secrets (notes live in client-side encrypted storage only, with explicit "if you lose this, funds are gone" UX). Document that ShadowSwap is privacy tooling for lawful use; ToS prohibits sanctions evasion.

### 2.4 Incinerator
Pure on-chain composition, no third party:
- **Enumerate:** `getTokenAccountsByOwner` (+ DAS `getAssetsByOwner` for NFT/cNFT context)
- **Classify:** empty ATAs (rent only) / dust (< $0.01) / spam (heuristics: no metadata, known spam patterns, `token_registry.spam_score`) / frozen (flagged unclosable)
- **Instructions:** `createBurnInstruction` (or `burnChecked`) then `createCloseAccountInstruction` per account; Metaplex `burnV1` for NFTs (reclaims metadata rent too); batch ≤ ~24 close ops per tx (CU-simulated), multi-tx queue with progress
- **Safety rails:** simulation diff must show only expected closures; tokens worth > $1 require typed confirmation; frozen accounts surfaced but excluded
- Rent math shown upfront: `0.00203928 SOL` per ATA × selection

### 2.5 Radar
- **Trending:** Birdeye `/defi/token_trending` + DexScreener pairs API, merged + deduped server-side (`/api/radar/trending`, edge-cached 15s)
- **Spike detection:** server cron (1min) walks a hot-token universe (trending ∪ all users' watchlists), compares 5m/1h volume vs trailing baseline kept in Redis; breaches insert `alert_events` → Supabase Realtime → client
- **Wallet watch:** Helius enhanced websocket (`transactionSubscribe` with account filter) through ConnectionManager; enhanced parse gives human-readable activity ("bought 4.2M BONK on Raydium")
- **New pairs:** Helius `logsSubscribe` on Raydium/pump.fun program IDs, server-side filtered, rug heuristics (mint authority alive, top-10 holder %, LP not locked) computed before display

### 2.6 Oracle — AI + on-chain tools
Vercel AI SDK route (`/api/oracle/chat`) with Claude + tool use. Tools the model can call:

| Tool | Implementation |
| --- | --- |
| `getTransaction(sig)` | Helius enhanced tx → pre-digested into typed summary before hitting the model |
| `getWalletOverview(addr)` | balances, top holdings, recent activity, age, tags |
| `getTokenIntel(mint)` | metadata, holders, liquidity, authorities, rug heuristics |
| `getAccountInfo(addr)` | raw account, owner program, parsed if known IDL |
| `searchDocs(query)` | RAG over embedded Solana/Anchor/SPL/protocol docs (pgvector) |
| `getForgeReport(repo)` | pulls an existing Forge report into context |

System prompt enforces: cite addresses/sigs precisely, simulate-don't-speculate, flag risk patterns. Context chips let users pin a tx/wallet/token so tools pre-fetch before first token streams.

### 2.7 Perps — Drift
- `@drift-labs/sdk` (browser build) + Drift DLOB server for the orderbook
- **Read path (no wallet):** DLOB websocket (`dlob.drift.trade`) for orderbook/trades; market accounts via ConnectionManager subscriptions for mark/funding/OI
- **Write path:** `DriftClient` with wallet adapter — `initializeUserAccount` (first use, framed as "open trading account ~0.035 SOL rent"), deposit/withdraw collateral, `placePerpOrder` (market/limit/post-only/reduce-only), close/modify/cancel
- **Account state:** `User` subscription → health, leverage, unrealized PnL streamed into the store; liq price computed via SDK margin math and previewed in the order ticket *before* placing
- Bundle note: Drift SDK is heavy — Perps' Focused chunk loads it; the Ambient strip uses only DLOB websocket + market account math to stay light

### 2.8 Signal
Three message lanes, one thread UI:
1. **On-chain public memo:** SPL Memo program ix (`MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`) + 0-lamport transfer to recipient so it lands in their tx history; indexed by Helius webhook → `messages` row with `tx_signature`
2. **Off-chain plaintext:** Supabase insert, realtime delivery — fast lane
3. **Off-chain E2E:** x25519 ECDH (per-conversation key from a wallet-signed derivation message — never the wallet's actual key) + xsalsa20-poly1305 (`tweetnacl.box`); server stores ciphertext only
- Inbox works for *any* recipient address; messages to wallets that never used TEK sit until claimed (on-chain memos are visible regardless — that's the hook)
- SNS (.sol) resolution in the compose field; spam control: unknown-sender threads land in a "requests" tray, optional min-SOL-balance filter

## 3. Provider Abstraction

Every external dependency sits behind an interface in `lib/providers/` (`LaunchProvider`, `SwapProvider`, `PerpsProvider`, `IntelProvider`, `PrivacyProvider`). Swapping Jupiter→DFlow, pump.fun→another launchpad, or Birdeye→Codex is a one-file change. This is load-bearing: half these APIs will change within a year.

## 4. API Key & Quota Map

| Service | Where | Free-tier viable? |
| --- | --- | --- |
| Helius | server proxy | Dev yes; prod needs paid (websockets + DAS volume) |
| Jupiter | client direct (public) / server for referral mgmt | Yes |
| PumpPortal | server proxy | Per-tx fee model (0.5% on local API) |
| Birdeye | server proxy + edge cache | Starter tier, cache aggressively |
| Drift DLOB | client direct | Public |
| Anthropic | server only | Paid; Oracle metered per tier |
| Pinata/IPFS | server | Cheap |
