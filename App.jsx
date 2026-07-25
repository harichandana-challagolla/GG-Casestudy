import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Sparkles, CheckCircle2, UserRound, Calculator, Lock, AlertTriangle,
  FileText, ArrowRight, Pencil, Check, Flag, X, Search, Info, ShieldCheck,
  ChevronRight,
} from "lucide-react";

/* =========================================================================
   GGCPA — Return Review  ·  challenges 01 (traceability), 08 (affordances),
   10 (trustworthy AI).  All data below is fabricated. The "AI" is a stub:
   confidence scores and extraction traces are hardcoded, not computed.
   ========================================================================= */

// ---- Fake source documents (rendered as mock forms with highlightable boxes)
const DOCUMENTS = {
  "w2-acme": {
    id: "w2-acme", kind: "W-2", title: "Form W-2 — Wage and Tax Statement",
    issuer: "Acme Corporation", meta: "EIN 12-3456789", page: 1, pages: 1, skew: false,
    boxes: [
      { id: "b1", num: "1", label: "Wages, tips, other comp.", value: "84,200.00" },
      { id: "b2", num: "2", label: "Federal income tax withheld", value: "12,630.00" },
      { id: "b3", num: "3", label: "Social security wages", value: "84,200.00" },
      { id: "b4", num: "4", label: "Social security tax withheld", value: "5,220.40" },
      { id: "b5", num: "5", label: "Medicare wages and tips", value: "84,200.00" },
      { id: "b6", num: "6", label: "Medicare tax withheld", value: "1,220.90" },
    ],
  },
  "1099int-fnb": {
    id: "1099int-fnb", kind: "1099-INT", title: "Form 1099-INT — Interest Income",
    issuer: "First National Bank", meta: "Payer TIN 98-7654321", page: 1, pages: 1, skew: false,
    boxes: [
      { id: "b1", num: "1", label: "Interest income", value: "1,842.00" },
      { id: "b4", num: "4", label: "Federal income tax withheld", value: "0.00" },
    ],
  },
  "1099div-vanguard": {
    id: "1099div-vanguard", kind: "1099-DIV", title: "Form 1099-DIV — Dividends and Distributions",
    issuer: "Vanguard Brokerage", meta: "Payer TIN 45-1122334", page: 1, pages: 1, skew: true,
    boxes: [
      { id: "b1a", num: "1a", label: "Total ordinary dividends", value: "2,410.00" },
      { id: "b1b", num: "1b", label: "Qualified dividends", value: "2,180.00" },
      { id: "b2a", num: "2a", label: "Total capital gain distr.", value: "—" },
    ],
  },
  "1099b-fidelity": {
    id: "1099b-fidelity", kind: "1099-B", title: "Form 1099-B — Proceeds from Broker Transactions",
    issuer: "Fidelity Investments", meta: "Payer TIN 22-5566778", page: 1, pages: 3, skew: false,
    boxes: [
      { id: "gain", num: "—", label: "Net realized gain (short + long)", value: "3,120.00" },
    ],
  },
  "yearend-fidelity": {
    id: "yearend-fidelity", kind: "Statement", title: "Year-End Account Summary",
    issuer: "Fidelity Investments", meta: "Account ••• 4471", page: 8, pages: 12, skew: false,
    boxes: [
      { id: "gain", num: "—", label: "Total realized gain/loss", value: "3,450.00" },
    ],
  },
  "1098e-navient": {
    id: "1098e-navient", kind: "1098-E", title: "Form 1098-E — Student Loan Interest",
    issuer: "Navient", meta: "Payer TIN 33-9988776", page: 1, pages: 1, skew: false,
    boxes: [
      { id: "b1", num: "1", label: "Student loan interest received", value: "1,100.00" },
    ],
  },
};

// ---- The return. `status` drives the affordance system (challenge 08).
const INITIAL_FIELDS = [
  {
    id: "wages", section: "Income", line: "1a", label: "Wages, salaries, tips",
    value: 84200, status: "ai",
    trace: {
      docId: "w2-acme", boxId: "b1", confidence: 0.99,
      reason: "Clean digital W-2. Box 1 read with high certainty and matches SSA copy.",
      chain: [{ t: "W-2 · Acme Corp · Box 1", v: 84200 }, { t: "Reported wages", v: 84200 }],
    },
  },
  {
    id: "fedwh", section: "Income", line: "25a", label: "Federal tax withheld (W-2)",
    value: 12630, status: "verified", verifiedBy: "You",
    trace: {
      docId: "w2-acme", boxId: "b2", confidence: 0.99,
      reason: "W-2 Box 2. Confirmed against employer copy.",
      chain: [{ t: "W-2 · Acme Corp · Box 2", v: 12630 }],
    },
  },
  {
    id: "interest", section: "Income", line: "2b", label: "Taxable interest",
    value: 1842, status: "ai",
    trace: {
      docId: "1099int-fnb", boxId: "b1", confidence: 0.94,
      reason: "Single 1099-INT, Box 1. Legible scan; one payer only.",
      chain: [{ t: "1099-INT · First National · Box 1", v: 1842 }],
    },
  },
  {
    id: "dividends", section: "Income", line: "3b", label: "Ordinary dividends",
    value: 2410, status: "ai",
    trace: {
      docId: "1099div-vanguard", boxId: "b1a", confidence: 0.61,
      reason: "Source scan is skewed and Box 1a is partly clipped. Value inferred from the visible digits — verify against the broker copy before accepting.",
      chain: [{ t: "1099-DIV · Vanguard · Box 1a", v: 2410 }],
    },
  },
  {
    id: "capgains", section: "Income", line: "7", label: "Capital gain / loss",
    value: 3120, status: "flagged",
    conflict: {
      a: { docId: "1099b-fidelity", value: 3120, note: "1099-B, net of wash sales" },
      b: { docId: "yearend-fidelity", value: 3450, note: "Year-end summary, pre-adjustment" },
      reason: "Two Fidelity documents report different realized gains. The 1099-B applies wash-sale adjustments the summary does not. Pick the authoritative source.",
    },
    trace: {
      docId: "1099b-fidelity", boxId: "gain", confidence: 0.55,
      reason: "Conflicting sources — see resolution panel.",
      chain: [{ t: "1099-B · Fidelity", v: 3120 }],
    },
  },
  {
    id: "studentloan", section: "Adjustments", line: "21", label: "Student loan interest",
    value: 1100, status: "verified", verifiedBy: "S. Reddy",
    trace: {
      docId: "1098e-navient", boxId: "b1", confidence: 0.97,
      reason: "1098-E Box 1. Under the $2,500 cap; fully deductible.",
      chain: [{ t: "1098-E · Navient · Box 1", v: 1100 }],
    },
  },
  {
    id: "ira", section: "Adjustments", line: "20", label: "IRA deduction",
    value: 6000, status: "client",
    source: {
      kind: "questionnaire",
      question: "Did you contribute to a traditional IRA for the 2025 tax year? If so, how much?",
      answeredOn: "Mar 14, 2026",
      note: "Client-entered. No document on file yet — request Form 5498 to substantiate.",
    },
  },
  {
    id: "stdded", section: "Deductions", line: "12", label: "Standard deduction",
    value: 14600, status: "locked",
    lockReason: "Set by filing status (Single, 2025). Change filing status to affect this line.",
  },
  {
    id: "totinc", section: "Totals", line: "9", label: "Total income",
    value: 91572, status: "calculated",
    derived: { formula: "Wages + Interest + Dividends + Capital gain", parts: ["wages", "interest", "dividends", "capgains"] },
  },
  {
    id: "agi", section: "Totals", line: "11", label: "Adjusted gross income",
    value: 84472, status: "calculated",
    derived: { formula: "Total income − IRA deduction − Student loan interest", parts: ["totinc", "ira", "studentloan"] },
  },
  {
    id: "taxable", section: "Totals", line: "15", label: "Taxable income",
    value: 69872, status: "calculated",
    derived: { formula: "AGI − Standard deduction", parts: ["agi", "stdded"] },
  },
  {
    id: "taxdue", section: "Totals", line: "22", label: "Total tax",
    value: 10420, status: "locked",
    lockReason: "This line is locked because the return was filed on Apr 2, 2026. Amend the return to change it.",
  },
];

// ---- State system (challenge 08): one hue per meaning, nothing else.
const STATES = {
  ai:         { name: "AI extracted", chip: "AI", Icon: Sparkles,      bar: "bg-amber-400",   tint: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400",   editable: true,  clickable: true,  blurb: "Pulled from a document by AI. Review before you rely on it." },
  verified:   { name: "Verified",     chip: "✓",  Icon: CheckCircle2,  bar: "bg-emerald-500", tint: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", editable: true,  clickable: true,  blurb: "A preparer confirmed this value." },
  client:     { name: "Client answer",chip: "CL", Icon: UserRound,     bar: "bg-violet-400",  tint: "bg-violet-50",  text: "text-violet-700",  dot: "bg-violet-400",  editable: true,  clickable: true,  blurb: "Entered by the client in the questionnaire." },
  calculated: { name: "Calculated",   chip: "ƒ",  Icon: Calculator,    bar: "bg-sky-400",     tint: "bg-sky-50",     text: "text-sky-700",     dot: "bg-sky-400",     editable: false, clickable: true,  blurb: "Computed from other fields. Not directly editable." },
  locked:     { name: "Locked",       chip: "",   Icon: Lock,          bar: "bg-slate-300",   tint: "bg-slate-100",  text: "text-slate-500",   dot: "bg-slate-300",   editable: false, clickable: true,  blurb: "Immutable — filed or system-set." },
  flagged:    { name: "Needs review", chip: "!",  Icon: AlertTriangle, bar: "bg-rose-500",    tint: "bg-rose-50",    text: "text-rose-700",    dot: "bg-rose-500",    editable: true,  clickable: true,  blurb: "Sources disagree. Resolve before filing." },
};

const money = (n) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const confBand = (c) =>
  c >= 0.9 ? { label: "High", color: "text-emerald-600", bar: "bg-emerald-500" }
  : c >= 0.75 ? { label: "Medium", color: "text-amber-600", bar: "bg-amber-400" }
  : { label: "Low", color: "text-rose-600", bar: "bg-rose-500" };

/* ---------------------------------------------------------------- Document */
function DocumentView({ field, docId, activeBox }) {
  const doc = docId ? DOCUMENTS[docId] : null;
  const boxRefs = useRef({});

  useEffect(() => {
    if (activeBox && boxRefs.current[activeBox]) {
      boxRefs.current[activeBox].scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeBox, docId]);

  if (!doc) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-8 text-slate-400">
        <FileText className="w-8 h-8 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-slate-500">No source document</p>
        <p className="text-xs mt-1 max-w-xs">
          This value didn't come from an uploaded form. Its origin is shown in the panel on the right.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <FileText className="w-4 h-4" strokeWidth={1.75} />
          {doc.kind}
          <span className="text-slate-300">·</span>
          <span>page {doc.page} of {doc.pages}</span>
        </div>
        {doc.skew && (
          <span className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
            scanned copy — low quality
          </span>
        )}
      </div>

      <div className={`mx-auto max-w-md bg-white border border-slate-300 shadow-sm rounded-sm ${doc.skew ? "-rotate-1" : ""}`}>
        <div className="border-b border-slate-300 px-4 py-3">
          <div className="text-[11px] uppercase tracking-widest text-slate-400 font-semibold">{doc.title}</div>
          <div className="mt-1 flex items-baseline justify-between">
            <div className="text-sm font-semibold text-slate-800">{doc.issuer}</div>
            <div className="text-[11px] text-slate-400 font-mono">{doc.meta}</div>
          </div>
        </div>
        <div className={`p-3 grid grid-cols-2 gap-2 ${doc.skew ? "opacity-90" : ""}`}>
          {doc.boxes.map((b) => {
            const on = b.id === activeBox;
            return (
              <div
                key={b.id}
                ref={(el) => (boxRefs.current[b.id] = el)}
                className={`rounded-sm border px-2.5 py-1.5 transition-all duration-300 ${
                  on ? "border-slate-900 ring-2 ring-slate-900 bg-amber-50 shadow-md"
                     : "border-slate-200 bg-slate-50/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-slate-400">{b.num}</span>
                  <span className="text-[10px] text-slate-500 leading-tight">{b.label}</span>
                </div>
                <div className={`font-mono text-sm mt-0.5 ${on ? "font-bold text-slate-900" : "text-slate-700"}`}>
                  {b.value}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {field?.trace?.docId === doc.id && activeBox && (
        <div className="mx-auto max-w-md mt-3 flex items-center gap-2 text-[11px] text-slate-500 justify-center">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-900" />
          Highlighted box is the source for
          <span className="font-semibold text-slate-700">{field.label}</span>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Confidence */
function Confidence({ c }) {
  const band = confBand(c);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500">AI confidence</span>
        <span className={`text-xs font-semibold ${band.color}`}>
          {Math.round(c * 100)}% · {band.label}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${band.bar} rounded-full transition-all`} style={{ width: `${c * 100}%` }} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Provenance */
function Provenance({ field, fields, onAccept, onSave, onFlag, onResolve }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  useEffect(() => { setEditing(false); }, [field?.id]);

  if (!field) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 text-slate-400">
        <Info className="w-7 h-7 mb-3" strokeWidth={1.5} />
        <p className="text-sm font-medium text-slate-500">Select a field</p>
        <p className="text-xs mt-1 max-w-xs">
          Pick any line on the return to trace it back to its source and confidence.
        </p>
      </div>
    );
  }

  const st = STATES[field.status];
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]));

  return (
    <div className="h-full overflow-auto">
      {/* header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>FORM 1040</span><ChevronRight className="w-3 h-3" /><span>LINE {field.line}</span>
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900 leading-tight">{field.label}</h2>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${st.tint} ${st.text}`}>
            <st.Icon className="w-3 h-3" strokeWidth={2} /> {st.name}
          </span>
          <span className="font-mono text-sm text-slate-900 ml-auto">${money(field.value)}</span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* AI-extracted: confidence + evidence + accept/edit/flag */}
        {field.trace && field.status !== "flagged" && (
          <>
            <Confidence c={field.trace.confidence} />
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> Why this confidence
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{field.trace.reason}</p>
            </div>
          </>
        )}

        {/* transformation chain (challenge 01) */}
        {field.trace?.chain && field.status !== "flagged" && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">How this value was derived</div>
            <div className="space-y-1.5">
              {field.trace.chain.map((step, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-white border border-slate-100 rounded-md px-2.5 py-1.5">
                  <span className="text-slate-600">{step.t}</span>
                  <span className="font-mono font-medium text-slate-900">${money(step.v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* calculated: formula from other fields */}
        {field.derived && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">Computed from</div>
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 mb-2">
              <p className="text-xs text-sky-800 font-medium">{field.derived.formula}</p>
            </div>
            <div className="space-y-1.5">
              {field.derived.parts.map((pid) => (
                <div key={pid} className="flex items-center justify-between text-xs bg-white border border-slate-100 rounded-md px-2.5 py-1.5">
                  <span className="text-slate-600">{byId[pid]?.label}</span>
                  <span className="font-mono font-medium text-slate-900">${money(byId[pid]?.value ?? 0)}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-2">Updates automatically when its inputs change.</p>
          </div>
        )}

        {/* client-answered */}
        {field.source?.kind === "questionnaire" && (
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-2">From the client questionnaire</div>
            <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
              <p className="text-xs text-violet-900 italic leading-relaxed">"{field.source.question}"</p>
              <p className="text-[11px] text-violet-500 mt-2">Answered {field.source.answeredOn}</p>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-2 mt-2">
              {field.source.note}
            </p>
          </div>
        )}

        {/* locked */}
        {field.status === "locked" && (
          <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 flex gap-2.5">
            <Lock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 leading-relaxed">{field.lockReason}</p>
          </div>
        )}

        {/* conflict resolution (edge case) */}
        {field.status === "flagged" && field.conflict && (
          <div>
            <div className="rounded-lg bg-rose-50 border border-rose-100 p-3 mb-3 flex gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-xs text-rose-700 leading-relaxed">{field.conflict.reason}</p>
            </div>
            {["a", "b"].map((k) => {
              const c = field.conflict[k];
              const d = DOCUMENTS[c.docId];
              return (
                <button
                  key={k}
                  onClick={() => onResolve(field.id, c.value, c.docId)}
                  className="w-full text-left mb-2 rounded-lg border border-slate-200 hover:border-slate-900 hover:shadow-sm p-3 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{d.issuer} · {d.kind}</span>
                    <span className="font-mono text-sm font-bold text-slate-900">${money(c.value)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">{c.note}</p>
                  <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 group-hover:text-slate-900">
                    Use this value <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* actions for AI-extracted / verified */}
        {(field.status === "ai" || field.status === "verified") && (
          <div className="pt-1">
            {editing ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-500">Corrected value</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">$</span>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="flex-1 font-mono text-sm border border-slate-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { onSave(field.id, parseFloat(draft || field.value)); setEditing(false); }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md py-2 hover:bg-slate-700"
                  >
                    <Check className="w-3.5 h-3.5" /> Save correction
                  </button>
                  <button onClick={() => setEditing(false)} className="px-3 text-xs font-medium text-slate-500 hover:text-slate-900">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                {field.status === "ai" && (
                  <button
                    onClick={() => onAccept(field.id)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-900 text-white text-xs font-semibold rounded-md py-2 hover:bg-slate-700"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                )}
                <button
                  onClick={() => { setDraft(String(field.value)); setEditing(true); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 border border-slate-300 text-slate-700 text-xs font-semibold rounded-md py-2 hover:border-slate-900"
                >
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => onFlag(field.id)}
                  className="inline-flex items-center justify-center px-3 border border-slate-300 text-slate-500 rounded-md hover:border-rose-400 hover:text-rose-600"
                  aria-label="Flag for review"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {field.verifiedBy && field.status === "verified" && (
              <p className="text-[11px] text-emerald-600 mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Confirmed by {field.verifiedBy}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- Field row */
function FieldRow({ field, selected, onSelect }) {
  const st = STATES[field.status];
  return (
    <button
      onClick={() => onSelect(field.id)}
      className={`w-full text-left flex items-stretch gap-0 rounded-md overflow-hidden transition-all ${
        selected ? "ring-2 ring-slate-900 shadow-sm" : "ring-1 ring-slate-100 hover:ring-slate-300"
      }`}
    >
      <span className={`w-1 shrink-0 ${st.bar}`} />
      <span className={`flex-1 flex items-center gap-3 px-3 py-2.5 ${selected ? "bg-white" : "bg-white"}`}>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-slate-400 shrink-0">L{field.line}</span>
            <span className="text-sm text-slate-800 truncate">{field.label}</span>
          </span>
          <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${st.tint} ${st.text}`}>
            <st.Icon className="w-2.5 h-2.5" strokeWidth={2.5} /> {st.name}
          </span>
        </span>
        <span className="font-mono text-sm text-slate-900 tabular-nums shrink-0">${money(field.value)}</span>
      </span>
    </button>
  );
}

/* --------------------------------------------------------------------- App */
export default function App() {
  const [fields, setFields] = useState(INITIAL_FIELDS);
  const [selectedId, setSelectedId] = useState("dividends");
  const [onlyReview, setOnlyReview] = useState(false);
  const [query, setQuery] = useState("");

  const selected = fields.find((f) => f.id === selectedId);
  const activeDoc = selected?.trace?.docId ?? null;
  const activeBox = selected?.trace?.boxId ?? null;

  const needsReview = fields.filter((f) => f.status === "ai" || f.status === "flagged").length;
  const total = fields.length;
  const reviewed = total - needsReview;

  const shown = useMemo(() => {
    return fields.filter((f) => {
      if (onlyReview && !(f.status === "ai" || f.status === "flagged")) return false;
      if (query && !f.label.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [fields, onlyReview, query]);

  const sections = useMemo(() => {
    const order = ["Income", "Adjustments", "Deductions", "Totals"];
    const map = {};
    shown.forEach((f) => { (map[f.section] ||= []).push(f); });
    return order.filter((s) => map[s]).map((s) => ({ name: s, items: map[s] }));
  }, [shown]);

  const mutate = (id, patch) =>
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const onAccept = (id) => mutate(id, { status: "verified", verifiedBy: "You" });
  const onFlag = (id) => mutate(id, { status: "flagged" });
  const onSave = (id, val) =>
    mutate(id, {
      value: val, status: "verified", verifiedBy: "You (corrected)",
      trace: fields.find((f) => f.id === id)?.trace
        ? { ...fields.find((f) => f.id === id).trace, confidence: 1, reason: "Manually corrected by the reviewer. Overrides the AI extraction." }
        : undefined,
    });
  const onResolve = (id, val, docId) =>
    mutate(id, {
      value: val, status: "verified", verifiedBy: "You",
      conflict: undefined,
      trace: { docId, boxId: "gain", confidence: 1, reason: "Conflict resolved by the reviewer.", chain: [{ t: DOCUMENTS[docId].issuer, v: val }] },
    });

  return (
    <div className="w-full h-screen flex flex-col bg-slate-50 text-slate-900" style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      {/* top bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-slate-900 text-white grid place-items-center font-bold text-xs">GG</div>
          <div>
            <div className="text-sm font-semibold leading-none">Jordan Ellis · 2025 Return</div>
            <div className="text-[11px] text-slate-400 mt-0.5 font-mono">Form 1040 · Single · Return #GG-4471</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Review progress</div>
            <div className="text-sm font-semibold tabular-nums">
              {reviewed}<span className="text-slate-300">/{total}</span> lines cleared
            </div>
          </div>
          <div className="w-28 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${(reviewed / total) * 100}%` }} />
          </div>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex">
        {/* LEFT — the return */}
        <aside style={{ width: 340 }} className="shrink-0 border-r border-slate-200 bg-slate-50 flex flex-col">
          <div className="shrink-0 p-3 border-b border-slate-200 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search lines"
                className="w-full text-xs bg-white border border-slate-200 rounded-md pl-8 pr-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
            <button
              onClick={() => setOnlyReview((v) => !v)}
              className={`w-full text-xs font-medium rounded-md py-1.5 border transition-colors ${
                onlyReview ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {onlyReview ? `Showing ${needsReview} needing review` : `Show only needs-review (${needsReview})`}
            </button>
          </div>

          <div className="flex-1 overflow-auto p-3 space-y-4">
            {sections.map((sec) => (
              <div key={sec.name}>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 px-1">
                  {sec.name}
                </div>
                <div className="space-y-1.5">
                  {sec.items.map((f) => (
                    <FieldRow key={f.id} field={f} selected={f.id === selectedId} onSelect={setSelectedId} />
                  ))}
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="text-xs text-slate-400 text-center pt-6">No lines match. Clear the search or filter.</p>
            )}
          </div>

          {/* legend — the affordance key (challenge 08) */}
          <div className="shrink-0 border-t border-slate-200 p-3 bg-white">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Field states</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {Object.entries(STATES).map(([k, s]) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-sm ${s.dot}`} />
                  <span className="text-[11px] text-slate-600">{s.name}</span>
                  <span className="text-[10px] text-slate-300 ml-auto">{s.editable ? "editable" : "read-only"}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER — source document */}
        <main className="flex-1 min-w-0 bg-slate-100/70 border-r border-slate-200">
          <DocumentView field={selected} docId={activeDoc} activeBox={activeBox} />
        </main>

        {/* RIGHT — provenance + trust */}
        <section style={{ width: 360 }} className="shrink-0 bg-white">
          <Provenance
            field={selected}
            fields={fields}
            onAccept={onAccept}
            onSave={onSave}
            onFlag={onFlag}
            onResolve={onResolve}
          />
        </section>
      </div>
    </div>
  );
}
