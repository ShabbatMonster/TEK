# 09 — Monetization

Principle: **monetize flow, not access.** The grid is free — fees ride on value-moments (swaps, launches, trades), and the subscription sells *speed and depth*, never basic function. Crypto power users tolerate bps; they revolt at paywalls.

## 1. Protocol-Level Fee Capture (passive, scales with usage)

| Stream | Mechanism | Realistic take |
| --- | --- | --- |
| **Swap fees** | Jupiter referral program — `platformFeeBps` on every swap (10–20 bps default; 0 for Terminal tier) | The workhorse. $1M monthly volume @ 15bps = $1.5k/mo; scales linearly |
| **Launch fees** | Flat 0.02 SOL per Launchpad token + optional 0.5% of dev-buy | Aligned with pump.fun norms; meme cycles spike this hard |
| **Incinerator tithe** | 5% of reclaimed rent (framed as "5% of found money", shown transparently pre-burn) | Small but pure margin; great conversion psychology — users pay from proceeds |
| **Perps referral** | Drift referrer rewards on taker fees of referred accounts | Set-and-forget once users init accounts through TEK |
| **ShadowSwap relayer** | When TEK runs its own relayer: withdraw-relay fee (~0.1–0.25%) | Phase 5+; also a decentralization story |

## 2. Subscription Tiers

| | **FREE** | **PRO — $19/mo (or SOL/USDC)** | **TERMINAL — $99/mo** |
| --- | --- | --- | --- |
| All 9 modules | ✓ | ✓ | ✓ |
| Oracle | 20 msgs/day, sonnet-class | 300/day, priority | Unmetered, fable-class, API access |
| Forge | 3 audits/mo, public repos | 30/mo + private repos | Unlimited + CI webhook + PDF export |
| Radar | 15s refresh, 3 alert rules | 5s refresh, 25 rules, wallet-watch ×10 | Realtime push, unlimited rules, webhook alerts |
| Swap fee | 15 bps | 10 bps | 0 bps |
| Data refresh governor | standard | 2× | max |
| Layout editor / multi-grid profiles | — | ✓ | ✓ + multi-monitor grids |
| Signal | ✓ | custom handle, larger attachments | broadcast lists |

Payment rails: Stripe + native SOL/USDC (Solana Pay) with on-chain receipt → `users.tier`. Crypto-native users strongly prefer paying in-kind.

## 3. The Variable-Cost Problem (and answer)

AI (Oracle/Forge) and premium data (Helius/Birdeye) are the only real COGS. The tier table above is engineered so **every variable cost sits behind a metered or paid gate**: free Oracle uses the cheap model with hard caps; Forge free tier is 3 jobs; refresh-rate governor maps directly to RPC spend. Fee revenue (§1) has ~zero marginal cost and subsidizes free-tier data.

## 4. Later-Stage Options (not in v1, architecture leaves the door open)

- **TEK token** — only if it has a job: fee-share staking, tier access via holdings, module-marketplace gas. Explicitly *not* at launch; a token before product-market fit is a distraction and a regulatory surface.
- **Module marketplace** — third-party modules in user-customized slots; 70/30 rev split. The `ModuleDefinition` contract is already the SDK seed.
- **Forge B2B** — "audit badge" embeds + API for launchpads/aggregators that want repo-risk scores; per-seat CI integration.
- **Radar data API** — spike/rug-heuristic feed as a paid websocket for bots.
- **Sponsored discovery** — clearly-labeled promoted slots in Radar trending. Handle with extreme care: mislabeled promotion in a discovery tool is product suicide; if in doubt, skip.

## 5. Unit-Economics Sketch (1,000 WAU steady state)

```
Revenue/mo:   swap fees (~$8M vol @ 12bps avg)        ~$9,600
              subscriptions (6% pro, 1% terminal)      ~$2,100
              launches (~300 @ 0.02 SOL avg ~$4)       ~$1,200
              incinerator + perps referral             ~$600
                                                       ≈ $13,500
Costs/mo:     Helius growth plan                       ~$500
              AI inference (post-gating)               ~$900
              Birdeye/data + Supabase + Vercel + Fly   ~$700
              Forge compute                            ~$200
                                                       ≈ $2,300
```
Gross margin ~83% at modest scale; the model breaks even near ~150 WAU. Volume-correlated revenue means the same product earns 10× in a bull rotation with no cost change.
