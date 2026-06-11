# 03 — Database Schema

Supabase Postgres. Identity = wallet pubkey via Sign-In-With-Solana → Supabase JWT (`auth.jwt()->>'wallet'`). On-chain data is **never** mirrored wholesale — the DB stores only what the chain can't give us: messages, AI artifacts, jobs, prefs, and analytics.

## 1. Entity Overview

```
users ─┬─< user_settings (1:1)
       ├─< launches            (Launchpad)
       ├─< swap_history        (Swap — optional client-synced log)
       ├─< burn_history        (Incinerator)
       ├─< watchlists >─< watchlist_items
       ├─< alert_rules ─< alert_events     (Radar)
       ├─< oracle_sessions ─< oracle_messages
       ├─< forge_jobs ─< forge_reports ─< forge_findings
       └─< messages (sender/recipient)     (Signal)
token_registry (shared cache, no owner)
```

## 2. DDL

```sql
-- ============ IDENTITY ============
create table users (
  wallet        text primary key,                  -- base58 pubkey
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  display_name  text,                              -- optional, for Signal
  pfp_mint      text,                              -- NFT used as avatar
  tier          text not null default 'free'       -- free | pro | terminal
                check (tier in ('free','pro','terminal'))
);

create table user_settings (
  wallet        text primary key references users on delete cascade,
  grid_layout   jsonb not null default '{}',       -- custom slot arrangement
  priority_fee  text not null default 'fast',
  hotkey_overrides jsonb not null default '{}',
  module_prefs  jsonb not null default '{}',       -- per-module settings blob
  updated_at    timestamptz not null default now()
);

-- ============ LAUNCHPAD ============
create table launches (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null references users,
  mint          text not null unique,
  name          text not null,
  symbol        text not null,
  metadata_uri  text not null,
  image_url     text,
  tx_signature  text not null,
  dev_buy_sol   numeric(20,9) not null default 0,
  status        text not null default 'live'       -- live | bonded | failed
                check (status in ('live','bonded','failed')),
  created_at    timestamptz not null default now()
);
create index on launches (wallet, created_at desc);

-- ============ INCINERATOR ============
create table burn_history (
  id            uuid primary key default gen_random_uuid(),
  wallet        text not null references users,
  tx_signature  text not null,
  accounts_closed int not null default 0,
  tokens_burned   int not null default 0,
  sol_reclaimed   numeric(20,9) not null default 0,
  created_at    timestamptz not null default now()
);
create index on burn_history (wallet, created_at desc);

-- ============ RADAR ============
create table watchlists (
  id        uuid primary key default gen_random_uuid(),
  wallet    text not null references users,
  name      text not null default 'default',
  unique (wallet, name)
);

create table watchlist_items (
  watchlist_id uuid not null references watchlists on delete cascade,
  kind         text not null check (kind in ('token','wallet')),
  address      text not null,
  note         text,
  added_at     timestamptz not null default now(),
  primary key (watchlist_id, kind, address)
);

create table alert_rules (
  id          uuid primary key default gen_random_uuid(),
  wallet      text not null references users,
  kind        text not null check (kind in
                ('volume_spike','price_move','holder_surge','wallet_tx','new_pair_match')),
  params      jsonb not null,        -- {mint, multiple: 5, window: '1h'} etc
  channels    text[] not null default '{toast}',  -- toast | signal | webhook
  enabled     boolean not null default true,
  created_at  timestamptz not null default now()
);

create table alert_events (
  id          uuid primary key default gen_random_uuid(),
  rule_id     uuid not null references alert_rules on delete cascade,
  wallet      text not null,         -- denormalized for RLS + realtime filter
  payload     jsonb not null,
  fired_at    timestamptz not null default now(),
  seen        boolean not null default false
);
create index on alert_events (wallet, fired_at desc);

-- ============ ORACLE ============
create table oracle_sessions (
  id          uuid primary key default gen_random_uuid(),
  wallet      text not null references users,
  title       text not null default 'new session',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table oracle_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references oracle_sessions on delete cascade,
  role        text not null check (role in ('user','assistant','tool')),
  content     jsonb not null,        -- text + tool calls/results, AI-SDK shape
  tokens_in   int,
  tokens_out  int,
  created_at  timestamptz not null default now()
);
create index on oracle_messages (session_id, created_at);

-- ============ FORGE ============
create table forge_jobs (
  id          uuid primary key default gen_random_uuid(),
  wallet      text not null references users,
  repo_url    text not null,
  ref         text,                  -- branch/commit, null = default branch
  status      text not null default 'queued'
              check (status in ('queued','cloning','analyzing','scoring','done','failed')),
  progress    int not null default 0,          -- 0–100
  progress_log jsonb not null default '[]',    -- terminal feed lines
  error       text,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create index on forge_jobs (wallet, created_at desc);

create table forge_reports (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null unique references forge_jobs on delete cascade,
  repo_url      text not null,
  commit_sha    text not null,
  overall_score int not null,                  -- 0–100
  grades        jsonb not null,                -- {security, quality, activity, docs, decentralization}
  summary       text not null,                 -- AI executive summary (markdown)
  stats         jsonb not null,                -- loc, langs, deps, last_commit, contributors
  share_slug    text unique,                   -- public share link, null = private
  created_at    timestamptz not null default now()
);

create table forge_findings (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references forge_reports on delete cascade,
  severity    text not null check (severity in ('critical','high','medium','low','info')),
  category    text not null,        -- rug-vector | vuln | quality | dependency | license
  title       text not null,
  detail      text not null,
  file_path   text,
  line_start  int,
  line_end    int
);
create index on forge_findings (report_id, severity);

-- ============ SIGNAL ============
create table messages (
  id            uuid primary key default gen_random_uuid(),
  sender        text not null references users,
  recipient     text not null,                  -- may not be a TEK user yet
  thread_key    text not null,                  -- least(sender,recipient)||':'||greatest(...)
  kind          text not null check (kind in ('onchain_memo','offchain','offchain_e2e')),
  body          text,                           -- plaintext (public) — null when e2e
  ciphertext    bytea,                          -- e2e payload (x25519+xsalsa20-poly1305)
  sender_ephemeral_pub bytea,                   -- for e2e key agreement
  tx_signature  text,                           -- set for onchain_memo kind
  read_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index on messages (thread_key, created_at desc);
create index on messages (recipient, read_at) where read_at is null;

-- ============ SHARED CACHE ============
create table token_registry (         -- server-populated cache of token metadata
  mint        text primary key,
  symbol      text,
  name        text,
  decimals    int,
  image_url   text,
  verified    boolean not null default false,
  spam_score  real,                   -- incinerator spam classifier output
  updated_at  timestamptz not null default now()
);
```

## 3. Row-Level Security

Every user-owned table:

```sql
alter table oracle_sessions enable row level security;
create policy own_rows on oracle_sessions
  using (wallet = auth.jwt()->>'wallet')
  with check (wallet = auth.jwt()->>'wallet');
-- (repeat pattern for user_settings, launches, burn_history, watchlists,
--  alert_rules/events, forge_jobs, oracle_messages via session join)
```

Signal is the special case — both parties read, only sender inserts, recipient marks read:

```sql
alter table messages enable row level security;
create policy msg_read on messages for select
  using (auth.jwt()->>'wallet' in (sender, recipient));
create policy msg_send on messages for insert
  with check (sender = auth.jwt()->>'wallet');
create policy msg_mark_read on messages for update
  using (recipient = auth.jwt()->>'wallet')
  with check (recipient = auth.jwt()->>'wallet');
```

`forge_reports` with non-null `share_slug` get an additional public-select policy (anon role, slug lookup only).

## 4. Realtime Channels

| Channel | Table filter | Consumer |
| --- | --- | --- |
| `inbox:{wallet}` | `messages` where `recipient = wallet` | Signal unread badge + thread, even when ambient |
| `alerts:{wallet}` | `alert_events` where `wallet = wallet` | Radar spike toasts |
| `forge:{job_id}` | `forge_jobs` row updates | Audit progress terminal |

## 5. Storage Buckets

- `launch-images/` — original uploads pre-IPFS (audit trail + fast preview)
- `forge-artifacts/{job_id}/` — full AI analysis JSON (reports table stores the digest; the heavy artifact lives here)

## 6. What deliberately stays OUT of the DB

- Balances, token accounts, positions, orders — always live from chain/Drift
- Swap quotes/routes — ephemeral
- ShadowSwap notes/secrets — **client-side only**, encrypted local storage; the server storing them would defeat the module's purpose
- Prices/candles — provider APIs with edge caching, not Postgres
