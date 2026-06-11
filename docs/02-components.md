# 02 — Component Hierarchy

## 1. Application Tree

```
<RootLayout>                              app/layout.tsx — fonts, metadata, no chrome
└─ <Providers>
   ├─ <QueryClientProvider>               TanStack Query
   ├─ <ConnectionProvider>                @solana/wallet-adapter (endpoint = /api/rpc)
   ├─ <WalletProvider autoConnect>        Phantom, Solflare, Backpack, Ledger
   ├─ <SiwsAuthProvider>                  wallet sig → Supabase session
   ├─ <ThemeBridge>                       injects kernel CSS vars + module palettes
   └─ <TekKernel>                         the OS
      ├─ <StatusBar>                      top, 28px — the only shared chrome
      │  ├─ <TekSigil />                  logo, doubles as ⌘K trigger
      │  ├─ <SlotClock />                 live slot height + TPS + RPC latency dot
      │  ├─ <PriorityFeeDial />           global fee preset (eco/fast/turbo)
      │  ├─ <TxProcessMonitor />          in-flight tx pips, click → tray
      │  └─ <WalletPill />                connect / pubkey / SOL balance / disconnect
      ├─ <GridEngine>                     3×3 layout + focus state machine
      │  ├─ <ModuleCell slot={1..9}>      ×9 — shared shell
      │  │  ├─ <ModuleChrome>             header strip: glyph, title, status badge,
      │  │  │                             focus/settings buttons (16px, dense)
      │  │  ├─ <ModuleErrorBoundary>      crash = single dead cell, never dead OS;
      │  │  │                             shows "SEGFAULT" themed retry card
      │  │  ├─ <ModuleSuspense>           per-module themed skeleton
      │  │  └─ {Ambient | Focused}        from ModuleDefinition
      │  └─ <FocusDock>                   64px left rail in focus mode; 8 live glyphs
      ├─ <CommandPalette />               ⌘K — actions, token search, module jump
      ├─ <ContextMenuLayer />             right-click mint/wallet → cross-module actions
      ├─ <HotkeyCheatSheet />             "?" overlay
      ├─ <PreSignSheet />                 unified simulation-diff review before every signature
      └─ <ToastOS />                      bottom-right notification stack
```

## 2. Shared Primitive Layer (`components/ui`, `components/tek`)

shadcn/ui primitives (Button, Dialog, Sheet, Tabs, Tooltip, DropdownMenu, Command, Popover, Toggle, Slider) restyled to kernel tokens, plus TEK-specific primitives every module reuses:

| Component | Purpose |
| --- | --- |
| `<TokenIcon />` | mint → image with fallback identicon, verified badge |
| `<TokenCombobox />` | search-any-SPL-token input (Jupiter token list, fuzzy, recents) |
| `<AmountInput />` | balance-aware numeric input, MAX/HALF chips, USD mirror |
| `<Address />` | truncated pubkey, copy, explorer link, right-click context menu hook |
| `<Sparkline />` | 60×16 canvas price/volume line |
| `<DeltaNumber />` | animated number that flashes green/red on change (Bloomberg tick) |
| `<DataGrid />` | virtualized dense table (TanStack Table + Virtual) — Radar, Perps, Incinerator |
| `<StatBlock />` | label-over-value dense stat, the ambient-view workhorse |
| `<ScrambleText />` | text that resolves through cipher characters (ShadowSwap, headers) |
| `<TerminalFeed />` | autoscrolling monospace log stream (Forge, Radar events) |
| `<SimDiff />` | renders transaction simulation balance changes |

## 3. Per-Module Trees (Ambient → Focused)

### 3.1 Launchpad
```
Ambient:  <LaunchTicker/> recent pump.fun launches feed · <MyLaunchesStrip/> ·
          <BigRedButton "LAUNCH"/>
Focused:  <LaunchpadApp>
          ├─ <LaunchWizard>                3-step, keyboard-driven
          │  ├─ <StepIdentity>             name/symbol/description/socials
          │  ├─ <StepImage>                drop-zone → crop → IPFS upload preview
          │  └─ <StepEconomics>            dev-buy amount, slippage, fee preview
          ├─ <LaunchPreviewCard>           live pump.fun-style card as you type
          ├─ <LaunchConsole>               TerminalFeed: ipfs→metadata→tx→bonding
          └─ <MyLaunchesTable>             past launches, mcap, bonding progress
```

### 3.2 Swap
```
Ambient:  <QuickSwap/> mini pair input, one-click re-quote · <PriceTape/> watchlist marquee
Focused:  <SwapApp>
          ├─ <SwapPanel>
          │  ├─ <TokenCombobox side=in/> <AmountInput/> <FlipButton/> <TokenCombobox side=out/>
          │  ├─ <QuoteDetails>             rate, price impact, minimum out, route age
          │  └─ <SlippageControl/> <SwapButton/>
          ├─ <RouteVisualizer>             animated DAG of Jupiter route hops
          ├─ <PairChart>                   lightweight-charts candle view
          └─ <SwapHistory/>
```

### 3.3 ShadowSwap
```
Ambient:  <PrivacyScore wallet/> · <ShieldedBalance blurred/> · <NoiseField/> ambient anim
Focused:  <ShadowApp>
          ├─ <ShieldPanel>                 deposit → shielded pool (Privacy Cash flow)
          ├─ <PrivateSwapPanel>            swap within/withdraw to fresh address
          ├─ <ConfidentialPanel>           Token-2022 confidential transfer ops
          ├─ <PrivacyAudit>                wallet linkability report, dusting flags
          └─ <ShadowLedger>                local-only encrypted note history
```

### 3.4 Incinerator
```
Ambient:  <ReclaimableSol big/> "0.847 SOL reclaimable" · <DustCount/> · <FlameMeter/>
Focused:  <IncineratorApp>
          ├─ <ScanResults DataGrid>        empty accounts / dust / spam NFTs / frozen,
          │                                multi-select, spam-classifier column
          ├─ <BurnCart>                    staged items, total rent reclaim estimate
          ├─ <IgniteButton hold-to-burn/>  3s hold interaction, particle fire
          └─ <BurnHistory/>                lifetime SOL reclaimed counter
```

### 3.5 Radar
```
Ambient:  <SweepScope/> radial radar with token blips (size=mcap, ring=age) ·
          <SpikeAlerts last 3/>
Focused:  <RadarApp>
          ├─ <RadarTabs>
          │  ├─ <TrendingGrid/>            Birdeye/DexScreener trending, dense cards
          │  ├─ <SpikeFeed/>               TerminalFeed of volume/holder anomalies
          │  ├─ <WalletWatch/>             tracked wallets, live tx decode stream
          │  └─ <NewPairs/>                fresh pools w/ rug-risk heuristics
          ├─ <TokenInspector drawer/>      click blip → full intel sheet
          └─ <AlertRuleBuilder/>           "vol > 5x 1h avg" → toast/Signal alert
```

### 3.6 Oracle
```
Ambient:  <OracleEye/> idle animation, reacts to bus events · <LastInsight/> ·
          <AskBar/> (focuses module on submit)
Focused:  <OracleApp>
          ├─ <ChatThread>                  streamed markdown, code blocks, citations
          │  └─ <ToolCallCard/>            visible tool use: "reading tx 5Kq…"
          ├─ <ContextChips>                attach wallet / tx / token / Forge report
          ├─ <PromptDeck>                  canned power-prompts ("explain this tx")
          └─ <SessionRail>                 past conversations
```

### 3.7 Forge
```
Ambient:  <LastAuditScore gauge/> · <AuditQueue/> · <RepoInput compact/>
Focused:  <ForgeApp>
          ├─ <RepoIntake>                  URL paste → metadata fetch → confirm scan
          ├─ <AuditProgress>               TerminalFeed: clone→tree→deps→AI passes
          ├─ <ReportView>
          │  ├─ <ScoreHeader/>             0–100 + letter grade + radar chart
          │  ├─ <FindingsList/>            severity-grouped, file:line links
          │  ├─ <RedFlagBanner/>           critical patterns surfaced first
          │  └─ <FileTreeHeat/>            tree colored by risk density
          └─ <ReportShelf/>                past reports, shareable links
```

### 3.8 Perps
```
Ambient:  <PositionStrip/> live PnL of open positions (the cell tints green/red) ·
          <MarkPriceGrid 4 markets/>
Focused:  <PerpsApp>
          ├─ <MarketHeader>                market selector, mark/index/funding/OI
          ├─ <TradingViewPane/>            chart w/ position + liq overlays
          ├─ <OrderbookLadder/>            canvas-rendered, depth viz, click-to-price
          ├─ <OrderTicket>                 market/limit, leverage slider, margin calc,
          │                                liq-price preview
          ├─ <PositionsTabs>               positions / orders / fills / funding
          └─ <AccountHealthBar/>           collateral, leverage, liq proximity
```

### 3.9 Signal
```
Ambient:  <InboxPreview 3 latest/> · <UnreadBadge/> · <ComposeQuick/>
Focused:  <SignalApp>
          ├─ <ThreadList/>                 conversations keyed by counterparty wallet
          ├─ <ThreadView>
          │  ├─ <MessageBubbles/>          on-chain memo vs off-chain badge,
          │  │                             encrypted-lock indicator
          │  └─ <Composer>                 mode toggle: public memo / private E2E
          ├─ <NewMessageModal>             any wallet address, .sol resolution
          └─ <BroadcastView/>              public memos feed for connected wallet
```

## 4. Composition Rules

1. Modules import from `components/`, `lib/`, `kernel/` — **never from another module's folder**. ESLint `no-restricted-imports` enforces this.
2. All cross-module behavior goes through the EventBus or the kernel context menu registry.
3. Every Focused view must remain functional at 1280×800 fullscreen and degrade gracefully; every Ambient view must be legible at 420×300 (one grid cell on a 1280px screen).
4. Module-specific variants of shared primitives are made with the module's theme tokens, not forked components.
