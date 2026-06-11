import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "TEK Audit — Privacy Cash Protocol",
  description:
    "TEK integrator security & design review of the Privacy Cash Solana privacy protocol powering ShadowSwap's shielded pool.",
};

/* ---------------- report data ---------------- */

const SUBJECT = {
  name: "Privacy Cash",
  repo: "github.com/Privacy-Cash/privacy-cash",
  repoUrl: "https://github.com/Privacy-Cash/privacy-cash",
  programId: "9fhQBbumKEFuXtMBDw8AaQyAjCorLGJQiS3skWZdQyQD",
  verifyHash: "c6f1e5336f2068dc1c1e1c64e92e3d8495b8df79f78011e2620af60aa43090c5",
  multisig: "AWexibGxNFKTa1b5R5MN4PJr9HWnWRwf8EW9g8cLx3dM",
  release: "v1.0.2 (2025-10-16)",
};

const SNAPSHOT: [string, string][] = [
  ["Class", "ZK privacy pool (commitment / nullifier)"],
  ["Chain", "Solana mainnet-beta"],
  ["Program framework", "Anchor 0.31.1 (Rust)"],
  ["Proof system", "Groth16 over Circom v2.2.2 circuits"],
  ["Languages", "TypeScript 81.6% · Rust 16.1% · Circom 0.9%"],
  ["Program upgradeable", "Yes — authority held by multisig"],
  ["On-chain build", "Verifiable; hash published in repo"],
  ["License", "Present (LICENSE.md)"],
];

const PRIOR_AUDITS = [
  { who: "Accretion", scope: "ZK circuits, Solana program, crypto primitives" },
  { who: "HashCloak", scope: "ZK / cryptography review" },
  { who: "Zigtur", scope: "Program / protocol review" },
  { who: "Kriko", scope: "Program / protocol review" },
  { who: "Sherlock (contest)", scope: "Public competitive audit — 15,100 USDC pool" },
];

type Sev = "strength" | "low" | "medium" | "high";

const FINDINGS: { sev: Sev; title: string; detail: string }[] = [
  {
    sev: "strength",
    title: "Independently audited by four firms plus a public contest",
    detail:
      "The on-chain program and ZK circuits were reviewed by Accretion, HashCloak, Zigtur and Kriko, and additionally exposed to a Sherlock competitive audit. This is materially stronger third-party coverage than the median Solana protocol and the basis for our conditional approval.",
  },
  {
    sev: "strength",
    title: "Verifiable on-chain build with published hash",
    detail:
      `The repo ships a verifiable build and a verification hash (${SUBJECT.verifyHash.slice(0, 16)}…). An integrator can confirm the deployed bytecode at ${SUBJECT.programId.slice(0, 8)}… matches reviewed source rather than trusting a claim.`,
  },
  {
    sev: "strength",
    title: "Upgrade authority assigned to a multisig",
    detail:
      "Deployment instructions transfer the program's upgrade authority to a multisig wallet, removing single-key control over upgrades. We did not independently verify the multisig signer set or threshold — see conditions.",
  },
  {
    sev: "high",
    title: "Client-side note custody is unforgiving",
    detail:
      "Withdrawal authority is a secret note generated at deposit time. If the note is lost the funds are unrecoverable, and if it leaks the deposit is deanonymized or spendable. TEK must generate and hold notes strictly client-side, never transmit them, and present loss-of-funds warnings before any deposit.",
  },
  {
    sev: "high",
    title: "Regulatory / compliance surface (privacy pool)",
    detail:
      "Privacy pools carry sanctions and jurisdictional exposure. ShadowSwap must geo-fence per OFAC requirements, gate the shielded-pool panel behind explicit terms, and prohibit sanctions evasion. This is an operational/legal control on TEK's side, not a code defect in the protocol.",
  },
  {
    sev: "medium",
    title: "Program is upgradeable — integrators inherit upgrade risk",
    detail:
      "A multisig can still ship a new program version that changes behavior under integrators. TEK should pin the reviewed program hash, monitor the upgrade authority on-chain, and alert/halt the shielded-pool flow if the deployed hash changes.",
  },
  {
    sev: "medium",
    title: "Groth16 trusted setup must be verified end-to-end",
    detail:
      "Groth16 soundness depends on a trusted-setup ceremony; a compromised ceremony allows forged proofs (and thus fund theft from the pool). Before mainnet use, verify the ceremony provenance and that the proving/verifying keys in artifacts/ match the verifier embedded in the deployed program.",
  },
  {
    sev: "medium",
    title: "Privacy strength is a function of anonymity-set size and behavior",
    detail:
      "Unlinkability degrades with a small or low-activity pool and with user behavior (immediate withdraw, round amounts, reused gas source). TEK should surface anonymity-set context and default to privacy-preserving patterns (delay options, fresh withdraw address).",
  },
  {
    sev: "medium",
    title: "Vendored SDK + circuit artifacts are a supply-chain dependency",
    detail:
      "TEK consumes a client SDK and compiled circuit artifacts. Pin them at a reviewed commit, record artifact hashes, generate proofs in an isolated web worker, and re-verify hashes on update rather than tracking a moving branch.",
  },
  {
    sev: "low",
    title: "Withdraw-gas / relayer metadata can leak linkage",
    detail:
      "If a withdrawal's transaction fee is paid from a wallet linkable to the depositor, on-chain analysis can re-link the two sides. Prefer a relayer or a funded fresh fee-payer for the unshield step.",
  },
];

const CONDITIONS = [
  "Pin the deployed program hash; monitor the upgrade authority and halt on change.",
  "Verify the multisig signer set + threshold on-chain before pointing mainnet funds at the pool.",
  "Confirm Groth16 proving/verifying keys in artifacts/ match the deployed verifier.",
  "Vendor the SDK + circuit artifacts at a reviewed commit; record and re-check hashes on update.",
  "Generate and store notes only client-side; never transmit; show loss-of-funds warnings.",
  "Geo-fence and terms-gate the shielded-pool panel; prohibit sanctions evasion.",
];

const SEV_STYLE: Record<Sev, { label: string; color: string; bg: string }> = {
  strength: { label: "STRENGTH", color: "#2fd97b", bg: "rgba(47,217,123,0.08)" },
  low: { label: "LOW", color: "#6b7280", bg: "rgba(107,114,128,0.08)" },
  medium: { label: "MEDIUM", color: "#ffb224", bg: "rgba(255,178,36,0.08)" },
  high: { label: "HIGH", color: "#ff4d5e", bg: "rgba(255,77,94,0.08)" },
};

/* ---------------- page ---------------- */

export default function PrivacyCashAuditPage() {
  const highs = FINDINGS.filter((f) => f.sev === "high").length;
  const meds = FINDINGS.filter((f) => f.sev === "medium").length;
  const strengths = FINDINGS.filter((f) => f.sev === "strength").length;

  return (
    <main
      data-module="shadowswap"
      className="mx-auto min-h-dvh max-w-3xl px-6 py-12 font-mono text-fg"
    >
      {/* header */}
      <div className="mb-2 flex items-center justify-between">
        <Link href="/" className="text-[11px] tracking-[0.3em] text-dim hover:text-fg">
          ◂ TEK
        </Link>
        <span className="text-[10px] uppercase tracking-[0.25em] text-dim">
          public audit · shadowswap
        </span>
      </div>

      <h1 className="m-display text-3xl font-bold tracking-[0.04em] text-[var(--m-accent)]">
        Privacy Cash — Integrator Security &amp; Design Review
      </h1>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-dim">
        A TEK review of the Privacy Cash protocol that backs ShadowSwap&rsquo;s shielded
        pool. Scope: architecture, trust model, and supply-chain/operational risk for an
        integrator — grounded in public artifacts and the protocol&rsquo;s existing
        third-party audits. This is <strong className="text-fg">not</strong> a fresh
        cryptographic audit (see limitations).
      </p>

      {/* verdict */}
      <section className="mt-6 grid grid-cols-[auto_1fr] items-center gap-5 border border-line bg-cell2/40 p-5">
        <div className="text-center">
          <div className="m-display text-5xl font-bold text-[var(--m-accent)]">B+</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.2em] text-dim">86 / 100</div>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-up">
            Integrate with conditions
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-dim">
            Well-audited, verifiable, and multisig-governed. Residual risk is concentrated
            in integration hygiene and operational/legal controls that sit on TEK&rsquo;s
            side, not in unreviewed protocol code. Cleared for ShadowSwap behind the
            conditions below.
          </p>
          <div className="mt-2 flex gap-4 text-[10px] uppercase tracking-[0.15em]">
            <span style={{ color: SEV_STYLE.high.color }}>{highs} high</span>
            <span style={{ color: SEV_STYLE.medium.color }}>{meds} medium</span>
            <span style={{ color: SEV_STYLE.strength.color }}>{strengths} strengths</span>
          </div>
        </div>
      </section>

      {/* snapshot */}
      <Section title="Snapshot">
        <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {SNAPSHOT.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-line/60 py-1">
              <dt className="text-[11px] text-dim">{k}</dt>
              <dd className="text-right text-[11px] text-fg">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 space-y-1 text-[11px]">
          <Field label="Program">{SUBJECT.programId}</Field>
          <Field label="Verify hash">{SUBJECT.verifyHash}</Field>
          <Field label="Upgrade multisig">{SUBJECT.multisig}</Field>
          <Field label="Source">
            <a href={SUBJECT.repoUrl} target="_blank" rel="noreferrer" className="text-[var(--m-accent)] hover:underline">
              {SUBJECT.repo} · {SUBJECT.release}
            </a>
          </Field>
        </div>
      </Section>

      {/* prior audits */}
      <Section title="Prior third-party coverage">
        <p className="mb-3 text-[12px] leading-relaxed text-dim">
          We build on, rather than duplicate, the protocol&rsquo;s existing reviews. Coverage
          spans the ZK circuits, the Solana program, and the cryptographic primitives.
        </p>
        <ul className="space-y-1.5">
          {PRIOR_AUDITS.map((a) => (
            <li key={a.who} className="flex gap-3 text-[12px]">
              <span className="w-32 shrink-0 font-bold text-fg">{a.who}</span>
              <span className="text-dim">{a.scope}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* findings */}
      <Section title="Findings">
        <div className="space-y-2.5">
          {FINDINGS.map((f, i) => {
            const s = SEV_STYLE[f.sev];
            return (
              <div key={i} className="border border-line p-3" style={{ background: s.bg }}>
                <div className="flex items-center gap-2">
                  <span
                    className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em]"
                    style={{ color: s.color, border: `1px solid ${s.color}66` }}
                  >
                    {s.label}
                  </span>
                  <span className="text-[12px] font-bold text-fg">{f.title}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-dim">{f.detail}</p>
              </div>
            );
          })}
        </div>
      </Section>

      {/* conditions */}
      <Section title="Conditions of integration">
        <ol className="space-y-1.5">
          {CONDITIONS.map((c, i) => (
            <li key={i} className="flex gap-3 text-[12px] leading-relaxed">
              <span className="text-[var(--m-accent)]">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-dim">{c}</span>
            </li>
          ))}
        </ol>
      </Section>

      {/* limitations */}
      <Section title="Limitations & disclaimer">
        <p className="text-[12px] leading-relaxed text-dim">
          This is a design, trust-model, and supply-chain review based on public repository
          artifacts as of <strong className="text-fg">2026-06-11</strong>. It is{" "}
          <strong className="text-fg">not</strong> a substitute for the protocol&rsquo;s
          formal cryptographic audits, which we cite and rely upon. We did not re-run circuit
          formal verification, reproduce the trusted-setup ceremony, or independently confirm
          the multisig signer set. No statement here is financial or legal advice. Privacy
          tooling is provided for lawful use only; ShadowSwap&rsquo;s terms prohibit sanctions
          evasion.
        </p>
        <p className="mt-3 text-[10px] uppercase tracking-[0.2em] text-dim">
          Reviewer: TEK · The Everything Kernel · module 7 methodology (Forge)
        </p>
      </Section>

      <div className="mt-10 border-t border-line pt-4 text-center text-[10px] uppercase tracking-[0.25em] text-dim">
        <Link href="/" className="hover:text-[var(--m-accent)]">
          return to TEK ▸
        </Link>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--m-accent)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="w-28 shrink-0 text-dim">{label}</span>
      <span className="break-all text-fg">{children}</span>
    </div>
  );
}
