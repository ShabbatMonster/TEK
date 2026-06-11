# 05 — UI/UX System

## 1. Design Philosophy in Practice

Bloomberg Terminal × Arc Browser resolves to concrete rules:

- **Bloomberg:** information density is a feature. Small type, tight leading, tabular numerals everywhere, every pixel earns rent. No empty-state illustrations — empty states are dense placeholders showing what *will* be there.
- **Arc:** the chrome is alive. Soft depth, springy motion, a sidebar (FocusDock) with personality, delight in microinteractions — but only in the *kernel chrome*, never slowing down data surfaces.
- **Organized chaos:** the 9 modules clash on purpose (palette, type, texture) while the kernel grid, spacing rhythm, and motion language make them siblings. Like a city block: different storefronts, same street.

## 2. Kernel Layer (shared by all)

```css
:root {
  /* Substrate */
  --tek-void: #07080a;          /* page background — near-black, blue-leaning */
  --tek-cell: #0c0e12;          /* module cell base */
  --tek-line: #1a1d24;          /* hairline borders, 1px everywhere */
  --tek-text: #e8eaf0;
  --tek-text-dim: #6b7280;

  /* Rhythm — modules MUST use these */
  --tek-gap: 6px;               /* grid gutter — thin, terminal-like */
  --tek-radius: 8px;            /* cells */ 
  --tek-radius-inner: 4px;      /* controls */
  --tek-chrome-h: 26px;         /* module header strip */
  --tek-statusbar-h: 28px;

  /* Motion */
  --tek-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --tek-fast: 120ms; --tek-base: 200ms; --tek-focus: 240ms;
}
```

- **Layout:** `100dvw × 100dvh`, status bar 28px, grid fills the rest. `overflow: hidden` on body — scrolling exists only *inside* module panes (custom 4px scrollbars, module-tinted).
- **Type system:** three families, used by every module in different mixes:
  - `Geist Sans` — kernel UI, labels
  - `Geist Mono` / `Berkeley Mono` — all numbers, addresses, data (tabular-nums, slashed zero)
  - One display font *per module* (see matrix) for the module's title + hero numbers only
- **Texture:** 2% noise overlay on `--tek-void`; modules may add one signature texture (scanlines, grain, grid) at ≤4% opacity.
- **Color discipline:** kernel semantic colors (`--up: #2fd97b`, `--down: #ff4d5e`, `--warn: #ffb224`) are *identical across modules* — green/red mean the same thing everywhere, regardless of module palette.

## 3. The 9 Identities

Each module gets: an accent system, a display font, a texture, a signature microinteraction, and a UI paradigm. Module CSS vars are scoped to the cell (`[data-module='swap'] { --m-accent: ... }`).

| # | Module | Palette (accent on dark) | Display type | Texture | Paradigm | Signature microinteraction |
|---|--------|--------------------------|--------------|---------|----------|---------------------------|
| 1 | **Launchpad** | Molten amber `#ff8a00` → ember red gradient; warm grays | Industry-grade stencil (e.g. *Industry*, *Rajdhani*) | Diagonal hazard stripes on action zones | Industrial console — big switches, staged wizard like a launch sequence | The LAUNCH button arms: flip-cover → hold → countdown tick, cell rim glows hotter as metadata completes |
| 2 | **Swap** | Electric cyan `#00d1ff` + cobalt; cleanest module | Swiss grotesk (*Inter Display*), lowercase | None — pure surfaces | Precision instrument; centered, symmetric, calm | Flip button rotates route DAG through 180° with token icons orbiting; quote refresh sweeps a 800ms progress ring |
| 3 | **ShadowSwap** | Void violet `#7b5cff` on true black `#050407`; text dims to 60% | OCR-A / *Space Mono* — machine-readable vibe | Per-character scramble; faint static field | Counter-surveillance terminal — everything redacted-by-default, reveal on hover | Amounts render as `▓▓▓.▓▓` until hover; on shield, the balance *visibly encrypts* — digits cascade through cipher glyphs |
| 4 | **Incinerator** | Furnace red `#ff3b1f` + ash gray; charcoal surfaces | Heavy brutalist slab (*Archivo Black*) | Charred grain at panel edges | Demolition control panel — checklists, gang switches, one big igniter | Hold-to-burn: 3s hold, flame fills the button, ember particles rise from the cell bottom; reclaimed SOL counter rolls like a slot machine |
| 5 | **Radar** | Phosphor green `#39ff88` on deep green-black; amber for spikes | Bitmap/terminal (*VT323* for titles only) | CRT scanlines + radial sweep | Military scope — radial viz ambient, dense feeds focused | The radar sweep line passes every 4s; new blips ping with expanding ring + one-frame phosphor bloom; spikes make the whole cell pulse once |
| 6 | **Oracle** | Iridescent — violet→teal animated gradient `#a78bfa→#5eead4` on near-white-on-dark; the only module with light text glow | Editorial serif (*Newsreader* italic) for responses' first line | Soft aurora drift behind the eye | Conversational sanctum — generous (for TEK) whitespace, reading-optimized | The Eye: an orb that idles, dilates when you type, spins while tools run, and glances toward modules it's reading data from (bus-aware) |
| 7 | **Forge** | Steel `#9aa3b2` + safety yellow `#ffd60a`; gridded blueprint blue undertone | Engineering mono (*JetBrains Mono*), all-caps labels | Blueprint grid 8px, 3% opacity | CI/CD console — pipeline stages, logs, gauges | Audit progress renders as a forging sequence: stages spark when they complete; final score *stamps* onto the report with a metallic clunk (motion, not audio, by default) |
| 8 | **Perps** | Bloomberg navy `#0a1228` base, amber `#ffb224` accents, dense green/red ladders | None — data IS the typography (*Berkeley Mono* everywhere) | None; thinnest borders in TEK (0.5px) | The terminal-est module: 4-pane fixed workspace, zero decoration | Orderbook rows flash on update with 90ms decay; PnL number is the module's heartbeat — the ambient cell border tints by your live PnL |
| 9 | **Signal** | Pager teal `#2dd4bf` + hot pink `#ff6ec7` for unread; retro-tech | Pixel font (*Silkscreen*) for badges/timestamps only | Subtle halftone dots | Beeper-meets-IRC — thread rail + monospace messages | Incoming message: cell does a single pager-buzz wiggle (2px, 120ms) + pixel envelope unfolds; on-chain memos get a chain-link seal animation |

## 4. Interaction Model

### 4.1 The three states
1. **Ambient (grid):** every module is a live dashboard. Real data, real time, no placeholders. Target: a trader can leave TEK on a second monitor and read everything from ambient state alone.
2. **Hover:** cell scales 1.02, border brightens to module accent, **density layer** fades in (+80ms): secondary stats, sparklines, action buttons appear; siblings dim to 92%. No layout shift — the density layer overlays reserved space.
3. **Focus:** click header / press `1–9`. Framer Motion `layoutId` morph from cell → full viewport (240ms). Other modules collapse to FocusDock (64px left rail) with live glyphs. `Esc` returns to grid; `1–9` jumps focus directly between modules.

### 4.2 Keyboard map
```
GLOBAL                          GRID                MODULE-SCOPE EXAMPLES
⌘K      command palette         1–9  focus module   Swap:   ⌘↵ execute · F flip pair
Esc     back to grid            G    re-grid all    Perps:  B/S ticket side · ⇧1-4 leverage
?       hotkey overlay          W    toggle wallet  Radar:  ␣ pause feed · A new alert
⌘.      priority fee dial                           Oracle: ⌘↵ send · ⌘⇧C attach context
⌘/      focus Oracle ask-bar                        Signal: R reply · ⌘↵ send
⌘1–9    focus module (works everywhere)             Incin:  X toggle row · ⇧X select dust
```
Command palette (⌘K) is the universal entry: fuzzy-matches actions across all modules ("burn dust", "long SOL 5x", "audit <paste URL>", any token symbol → inspect/swap/watch).

### 4.3 Cross-module flow (the OS feel)
Right-click any token/address anywhere → kernel context menu: **Swap · Burn · Watch · Ask Oracle · Message owner · Copy**. Selecting routes through the EventBus and pre-fills the target module, focusing it. This single pattern is the product's "aha."

## 5. Motion Principles

- Transform/opacity only; no animated layout properties outside the focus morph
- Durations: data updates ≤120ms, hover ≤200ms, focus morph 240ms, nothing >400ms ever
- Every module's signature animation must be **interruptible** and respect `prefers-reduced-motion` (fall back to opacity fades; radar sweep and aurora pause)
- Data surfaces never animate position (rows don't slide) — they flash (`<DeltaNumber/>` pattern) so the eye keeps its anchor

## 6. Responsive Strategy (desktop-first)

| Breakpoint | Behavior |
| --- | --- |
| ≥1440px | Full 3×3, all density layers available |
| 1024–1439px | 3×3 retained; ambient views drop to `density="compact"` (primary stat + one signal each) |
| 768–1023px | 2×2 pages of modules, swipe/bracket-keys to page; focus mode unchanged |
| <768px | Single-module view + dock strip — TEK becomes a module switcher (explicitly a degraded companion mode, not the product) |

## 7. Accessibility floor

Dense ≠ inaccessible: 4.5:1 contrast minimum on all data text (each module palette verified), full keyboard reachability (the hotkey system *is* the a11y story), focus rings in module accent, `aria-live="polite"` on alert feeds, all iconography paired with text labels at hover/focus.
