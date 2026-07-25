# GGCPA — Return Review

A greenfield return-review interface for a client + CPA tax platform. This
prototype covers three of the case-study challenges as a single, coherent
screen rather than three disconnected demos:

- **01 · Source Document Traceability** — every figure traces to a source
  document, the exact box on that form, and the calculation that produced it.
- **08 · Clickable vs. Editable** — a six-state affordance system (AI-extracted,
  verified, client answer, calculated, locked, needs-review) with one color,
  one icon, and one editability rule each.
- **10 · Trustworthy AI** — confidence is never shown as a bare number; it always
  carries a plain-English reason and the evidence. Correcting the AI is a
  two-click inline edit that logs the override.

## Why these three together

They share one surface — the review of a single value — so building them as one
screen let me go deeper on interaction quality instead of spreading thin across
unrelated flows.

## What's real vs. simulated

**Real (working React):**
- All UI, layout, and the three-pane review interaction.
- Field state machine: Accept, inline Edit/override, Flag, and conflict
  resolution all mutate live state and re-render provenance.
- Calculated lines derive from their input fields.
- Search, "needs-review" filter, and the review-progress counter.

**Simulated (hardcoded fixtures — no live model or parsing):**
- The "AI": confidence scores, extraction traces, and derivation chains are
  fabricated data, not computed.
- Source documents are rendered mock forms (W-2, 1099-INT/DIV/B, 1098-E),
  not parsed scans. The "skewed scan" on the low-confidence 1099-DIV is a
  deliberate visual to justify its 61% confidence.
- No backend, auth, or persistence. Refreshing resets state.

## Edge cases wired up (not just the happy path)

- A low-confidence field with a visibly poor source scan.
- A field with **no** source document (client questionnaire answer).
- A **locked** field (return already filed) that explains why it can't change.
- A **calculated** field that chains from several other fields.
- A **conflict**: two documents report different capital gains; the reviewer
  resolves it by choosing the authoritative source.

## Run locally

```bash
npm install
npm run dev
```

## Deploy (Vercel)

```bash
npm install -g vercel   # if you don't have it
vercel                  # accept defaults; framework auto-detects as Vite
vercel --prod           # promote to a production URL to submit
```

Vercel auto-detects Vite: build command `npm run build`, output `dist`.
