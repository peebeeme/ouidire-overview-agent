"use client";

import { useState, useEffect } from "react";
import type {
  DocumentAnalysis,
  BundleAnalysis,
  OverviewResponse,
  CardLensResult,
  ReasoningCluster,
  OverviewCard,
} from "@/lib/overviewAgent";

import sampleDocData from "../data/sample/sample_document_oas_clean.json";
import sampleBundleData from "../data/sample/sample_bundle_two_docs_clean.json";

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#10131d",
  surface: "#151b2b",
  surface2: "#1a2035",
  border: "#2a3550",
  text: "#f3f4f6",
  secondary: "#cbd5e1",
  muted: "#8b95a7",
  dim: "#3d4f6e",
  narrative: "#f5b84b",
  narrativeDim: "#7a5a20",
  narrativeBg: "#1a1408",
  clinical: "#22d3ee",
  clinicalDim: "#0e5f6d",
  clinicalBg: "#021318",
  accent: "#818cf8",
  accentDim: "#3d4578",
  accentBg: "#0f1128",
  thesis: "#e9d5ff",
};

const CARDS_PREVIEW = 9;
const REASONING_PREVIEW = 5;

const LOADING_MESSAGES = [
  "Running Narrative · Record Distortion lens…",
  "Running Clinical · Diagnostic Failure lens…",
  "Synthesizing document analysis…",
];

type Dataset = "document" | "bundle";
type Phase = "idle" | "loading" | "done" | "error";

// ─── Atoms ────────────────────────────────────────────────────────────────────

function MacroTag({ label, lens }: { label: string; lens: "narrative" | "clinical" }) {
  const isNarrative = lens === "narrative";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontFamily: "monospace",
        color: isNarrative ? C.narrative : C.clinical,
        background: isNarrative ? C.narrativeBg : C.clinicalBg,
        border: `1px solid ${isNarrative ? C.narrativeDim : C.clinicalDim}`,
        marginRight: 4,
        marginBottom: 3,
        whiteSpace: "nowrap" as const,
      }}
    >
      {label}
    </span>
  );
}

function Label({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.8,
        textTransform: "uppercase" as const,
        color: color ?? C.muted,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: "52px 0" }} />;
}

// ─── Card grid ────────────────────────────────────────────────────────────────

function CardGrid({ cards, limit }: { cards: OverviewCard[]; limit?: number }) {
  const displayed = limit ? cards.slice(0, limit) : cards;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 10,
      }}
    >
      {displayed.map((card) => (
        <div
          key={card.cardId}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 7,
            padding: 13,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 10, fontFamily: "monospace", color: C.muted }}>
              {card.cardId}
            </span>
            <span style={{ fontSize: 10, color: C.muted, flexShrink: 0 }}>
              p.{card.page} · par.{card.paragraph}
            </span>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            {card.text}
          </p>
          <div style={{ fontSize: 11, color: C.muted }}>{card.source}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Card reasoning ───────────────────────────────────────────────────────────

function LensRow({
  result,
  lens,
}: {
  result: CardLensResult | undefined;
  lens: "narrative" | "clinical";
}) {
  const isNarrative = lens === "narrative";
  const color = isNarrative ? C.narrative : C.clinical;
  const hasFindings = (result?.macrosDetected?.length ?? 0) > 0;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 0",
        borderBottom: `1px solid ${C.dim}`,
      }}
    >
      <div
        style={{
          width: 72,
          flexShrink: 0,
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: 1.5,
          textTransform: "uppercase" as const,
          color,
          paddingTop: 3,
        }}
      >
        {isNarrative ? "Narrative" : "Clinical"}
      </div>
      <div style={{ flex: 1 }}>
        {hasFindings ? (
          <>
            <div style={{ marginBottom: 5 }}>
              {result!.macrosDetected.map((m) => (
                <MacroTag key={m} label={m} lens={lens} />
              ))}
            </div>
            <p style={{ margin: "0 0 4px", fontSize: 14, color: C.secondary, lineHeight: 1.55 }}>
              {result!.observation}
            </p>
            {result!.rationale && (
              <p style={{ margin: 0, fontSize: 13, color: C.muted, lineHeight: 1.45, fontStyle: "italic" }}>
                {result!.rationale}
              </p>
            )}
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: C.muted, fontStyle: "italic" }}>
            No pattern detected
          </p>
        )}
      </div>
    </div>
  );
}

function CardReasoningSection({
  cards,
  narrativeReasoning,
  clinicalReasoning,
}: {
  cards: OverviewCard[];
  narrativeReasoning: CardLensResult[];
  clinicalReasoning: CardLensResult[];
}) {
  const [showAll, setShowAll] = useState(false);
  const nMap = new Map(narrativeReasoning.map((r) => [r.cardId, r]));
  const cMap = new Map(clinicalReasoning.map((r) => [r.cardId, r]));

  const withFindings = cards.filter(
    (c) =>
      (nMap.get(c.cardId)?.macrosDetected?.length ?? 0) > 0 ||
      (cMap.get(c.cardId)?.macrosDetected?.length ?? 0) > 0
  );
  const clean = cards.length - withFindings.length;
  const displayed = showAll ? withFindings : withFindings.slice(0, REASONING_PREVIEW);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <Label>Card Reasoning</Label>
          <p style={{ margin: 0, fontSize: 13, color: C.muted }}>
            {withFindings.length} of {cards.length} cards have findings
            {clean > 0 && ` · ${clean} show no pattern`}
          </p>
        </div>
        {withFindings.length > REASONING_PREVIEW && (
          <button
            onClick={() => setShowAll((v) => !v)}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              border: `1px solid ${C.border}`,
              background: "transparent",
              color: C.muted,
              flexShrink: 0,
            }}
          >
            {showAll ? "Collapse" : `Show all ${withFindings.length} cards`}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 12 }}>
        {displayed.map((card) => (
          <div
            key={card.cardId}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "9px 14px",
                borderBottom: `1px solid ${C.border}`,
                display: "flex",
                gap: 12,
                alignItems: "baseline",
              }}
            >
              <span style={{ fontSize: 11, fontFamily: "monospace", color: C.muted }}>
                {card.cardId}
              </span>
              <span style={{ fontSize: 12, color: C.muted }}>{card.source}</span>
            </div>
            <div style={{ padding: "10px 14px 6px" }}>
              <p style={{ margin: "0 0 10px", fontSize: 14, color: C.secondary, lineHeight: 1.6 }}>
                {card.text}
              </p>
              <LensRow result={nMap.get(card.cardId)} lens="narrative" />
              <LensRow result={cMap.get(card.cardId)} lens="clinical" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Clusters ─────────────────────────────────────────────────────────────────

function ClusterCard({ cluster, lens }: { cluster: ReasoningCluster; lens: "narrative" | "clinical" }) {
  const isNarrative = lens === "narrative";
  const color = isNarrative ? C.narrative : C.clinical;
  const dimColor = isNarrative ? C.narrativeDim : C.clinicalDim;
  const bg = isNarrative ? C.narrativeBg : C.clinicalBg;

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${dimColor}`,
        borderRadius: 7,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 10, fontFamily: "monospace", color, marginBottom: 5 }}>
        {cluster.pattern}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
        {cluster.title}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: C.secondary, lineHeight: 1.6 }}>
        {cluster.reasoning}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, marginBottom: cluster.traceability.length > 0 ? 10 : 0 }}>
        {cluster.includedCards.map((id) => (
          <span
            key={id}
            style={{
              fontSize: 10,
              fontFamily: "monospace",
              color,
              background: `${color}14`,
              border: `1px solid ${dimColor}`,
              padding: "2px 6px",
              borderRadius: 3,
            }}
          >
            {id}
          </span>
        ))}
      </div>
      {cluster.traceability.length > 0 && (
        <div style={{ fontSize: 11, color, opacity: 0.65 }}>
          {cluster.traceability.join(" · ")}
        </div>
      )}
    </div>
  );
}

function ClustersSection({
  narrativeClusters,
  clinicalClusters,
}: {
  narrativeClusters: ReasoningCluster[];
  clinicalClusters: ReasoningCluster[];
}) {
  return (
    <div>
      <Label>Clusters</Label>
      <p style={{ margin: "0 0 24px", fontSize: 13, color: C.muted }}>
        {narrativeClusters.length} narrative · {clinicalClusters.length} clinical
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
              color: C.narrative,
              marginBottom: 12,
            }}
          >
            Narrative · Record Distortion
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {narrativeClusters.length > 0 ? (
              narrativeClusters.map((cl) => (
                <ClusterCard key={cl.clusterId} cluster={cl} lens="narrative" />
              ))
            ) : (
              <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>
                No narrative clusters identified.
              </p>
            )}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase" as const,
              color: C.clinical,
              marginBottom: 12,
            }}
          >
            Clinical · Diagnostic Failure
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {clinicalClusters.length > 0 ? (
              clinicalClusters.map((cl) => (
                <ClusterCard key={cl.clusterId} cluster={cl} lens="clinical" />
              ))
            ) : (
              <p style={{ fontSize: 13, color: C.muted, fontStyle: "italic" }}>
                No clinical clusters identified.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Document overview ────────────────────────────────────────────────────────

function DocumentOverviewSection({ result }: { result: DocumentAnalysis }) {
  return (
    <div>
      <Label>Document Overview</Label>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: C.muted }}>
        {result.cardCount} cards analyzed · two-lens synthesis
      </p>

      {/* Thesis first — most important conclusion */}
      {result.thesis && (
        <div
          style={{
            background: C.accentBg,
            border: `1px solid ${C.accentDim}`,
            borderLeft: `3px solid ${C.accent}`,
            borderRadius: 7,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, color: C.accent, marginBottom: 12, textTransform: "uppercase" as const }}>
            Document thesis
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 17, color: C.thesis, lineHeight: 1.75, fontStyle: "italic" }}>
            "{result.thesis}"
          </p>
          {result.traceability.length > 0 && (
            <div style={{ fontSize: 11, color: C.muted }}>
              {result.traceability.join(" · ")}
            </div>
          )}
        </div>
      )}

      {result.summary && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const, color: C.muted, marginBottom: 12 }}>
            Summary
          </div>
          <p style={{ margin: 0, fontSize: 16, color: C.text, lineHeight: 1.8 }}>{result.summary}</p>
        </div>
      )}

      {result.mechanisms.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const, color: C.muted, marginBottom: 14 }}>
            Dominant mechanisms
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.mechanisms.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.accent, fontVariantNumeric: "tabular-nums", flexShrink: 0, minWidth: 18 }}>
                  {i + 1}.
                </span>
                <span style={{ fontSize: 14, color: C.secondary, lineHeight: 1.65 }}>{m}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.contradictions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const, color: C.muted, marginBottom: 14 }}>
            Contradictions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.contradictions.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span style={{ color: C.narrative, fontSize: 14, flexShrink: 0 }}>↔</span>
                <span style={{ fontSize: 14, color: C.secondary, lineHeight: 1.6 }}>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.criticalOmissions.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, textTransform: "uppercase" as const, color: C.muted, marginBottom: 14 }}>
            Critical omissions
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.criticalOmissions.map((o, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
                <span style={{ color: C.clinical, fontSize: 12, flexShrink: 0 }}>◆</span>
                <span style={{ fontSize: 14, color: C.secondary, lineHeight: 1.6 }}>{o}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bundle thesis ────────────────────────────────────────────────────────────

function BundleThesisSection({ result }: { result: BundleAnalysis }) {
  return (
    <div>
      <Label>Bundle Thesis</Label>
      <p style={{ margin: "0 0 28px", fontSize: 13, color: C.muted }}>
        {result.documents.length} documents · cross-document synthesis
      </p>

      {result.documents.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 12 }}>Documents</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {result.documents.map((doc, i) => (
              <div
                key={i}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 5 }}>
                  {doc.documentTitle}
                  <span style={{ fontWeight: 400, color: C.muted, marginLeft: 8 }}>
                    {doc.cardCount} cards
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: C.secondary, lineHeight: 1.6 }}>
                  {doc.overview}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.crossDocumentPatterns.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Cross-document patterns</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {result.crossDocumentPatterns.map((p, i) => (
              <li key={i} style={{ fontSize: 14, color: C.secondary, lineHeight: 1.6 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {result.documentContrasts.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>Document contrasts</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
            {result.documentContrasts.map((c, i) => (
              <li key={i} style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {result.globalThesis && (
        <div
          style={{
            background: C.accentBg,
            border: `1px solid ${C.accentDim}`,
            borderLeft: `3px solid ${C.accent}`,
            borderRadius: 7,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.8, color: C.accent, marginBottom: 12, textTransform: "uppercase" as const }}>
            Global thesis
          </div>
          <p style={{ margin: "0 0 12px", fontSize: 17, color: C.thesis, lineHeight: 1.75, fontStyle: "italic" }}>
            "{result.globalThesis}"
          </p>
          {result.traceability.length > 0 && (
            <div style={{ fontSize: 11, color: C.muted }}>
              {result.traceability.join(" · ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [dataset, setDataset] = useState<Dataset>("document");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<OverviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingIdx, setLoadingIdx] = useState(0);
  const [showAllCards, setShowAllCards] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [runTime, setRunTime] = useState<number | null>(null);

  const currentData = dataset === "document" ? sampleDocData : sampleBundleData;
  const cards = currentData.cards as OverviewCard[];

  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(() => setLoadingIdx((i) => (i + 1) % LOADING_MESSAGES.length), 2400);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "loading") return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  async function handleAnalyse() {
    setPhase("loading");
    setLoadingIdx(0);
    setResult(null);
    setError(null);
    setRunTime(null);
    const start = Date.now();
    try {
      const res = await fetch("/api/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(currentData),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      setResult((await res.json()) as OverviewResponse);
      setRunTime(Math.round((Date.now() - start) / 1000));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setPhase("error");
    }
  }

  function handleDatasetChange(next: Dataset) {
    setDataset(next);
    setPhase("idle");
    setResult(null);
    setError(null);
    setRunTime(null);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.text,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "14px 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, letterSpacing: -0.2 }}>
          OuiDire
          <span style={{ color: C.muted, fontWeight: 400, marginLeft: 8, fontSize: 13 }}>
            Overview Agent
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.muted }}>
          Google AI Agents Challenge 2026 · Synthetic data · Public-safe
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          borderBottom: `1px solid ${C.border}`,
          padding: "52px 40px 48px",
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: C.accent, marginBottom: 16 }}>
          Overview Agent
        </div>
        <h1
          style={{
            margin: "0 0 18px",
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: -0.8,
            color: C.text,
            lineHeight: 1.15,
          }}
        >
          What does a legal-psychiatric record
          <br />
          <span style={{ color: C.accent }}>say beyond its individual cards?</span>
        </h1>
        <p style={{ margin: "0 0 14px", fontSize: 16, color: C.secondary, lineHeight: 1.7, maxWidth: 640 }}>
          Our app, OuiDire, turns long legal-psychiatric records into short, traceable cards, then uses Gemini 3.1 Flash-Lite to surface suggestions along predefined flaws and recurring documentary or clinical mechanisms. This experiment tests what comes next: reasoning across those cards to surface patterns and build a document or bundle-level thesis.
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 14, color: C.muted, lineHeight: 1.65, maxWidth: 620 }}>
          The source cards are synthetic and untagged. Gemini reads them through two analytical lenses: Narrative and Clinical. The signals are in the text; the reasoning is the demo.
        </p>
        <p style={{ margin: "0 0 28px", fontSize: 13, color: C.muted, lineHeight: 1.6, maxWidth: 620, fontStyle: "italic" }}>
          Developer&apos;s note: This challenge submission also serves OuiDire.app product development. It gives us a public-safe way to test document-level synthesis, bundle-level reasoning, and future improvements to the Master Brief — all of which depend on reasoning beyond individual cards. As a bonus, building this demo made it concrete: I can already see exactly how the Overview Agent will strengthen the Master Brief in production.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: C.muted,
            flexWrap: "wrap" as const,
          }}
        >
          {[
            { label: "Long documents", color: C.muted, weight: 400 },
            { label: "→", color: C.dim, weight: 400 },
            { label: "Cards", color: C.text, weight: 500 },
            { label: "→", color: C.dim, weight: 400 },
            { label: "Narrative", color: C.narrative, weight: 500 },
            { label: "+", color: C.dim, weight: 400 },
            { label: "Clinical", color: C.clinical, weight: 500 },
            { label: "→", color: C.dim, weight: 400 },
            { label: "Clusters", color: C.secondary, weight: 500 },
            { label: "→", color: C.dim, weight: 400 },
            { label: "Document thesis", color: C.accent, weight: 600 },
            { label: "→", color: C.dim, weight: 400 },
            { label: "Bundle thesis", color: C.narrative, weight: 700 },
          ].map(({ label, color, weight }, i) => (
            <span key={i} style={{ color, fontWeight: weight, fontSize: label === "Bundle thesis" ? 13 : 12 }}>
              {label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 40px 120px" }}>

        {/* Dataset selector + primary action */}
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "24px 28px",
            marginBottom: 40,
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <Label>Dataset</Label>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {(["document", "bundle"] as Dataset[]).map((d) => (
                <button
                  key={d}
                  onClick={() => handleDatasetChange(d)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    border: `1px solid ${
                      dataset === d
                        ? d === "document" ? C.accent : C.narrative
                        : C.border
                    }`,
                    background: dataset === d
                      ? d === "document" ? C.accentBg : C.narrativeBg
                      : C.bg,
                    color: d === "document" ? C.accent : C.narrative,
                    transition: "all 0.15s",
                  }}
                >
                  {d === "document"
                    ? `1. Document Analysis · ${sampleDocData.cards.length} cards`
                    : `2. Bundle Thesis · ${sampleBundleData.cards.length} cards · 2 documents`}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>{currentData.documentTitle}</div>
            {dataset === "document" ? (
              <div style={{ fontSize: 12, color: C.muted }}>
                First layer — reasoning within one document.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: C.narrative, opacity: 0.85 }}>
                Second layer — reasoning across documents toward a global thesis.
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              onClick={handleAnalyse}
              disabled={phase === "loading"}
              style={{
                padding: "12px 28px",
                borderRadius: 7,
                fontSize: 14,
                fontWeight: 600,
                cursor: phase === "loading" ? "not-allowed" : "pointer",
                border: `1px solid ${phase === "loading" ? C.border : C.accent}`,
                background: phase === "loading" ? C.surface2 : C.accentBg,
                color: phase === "loading" ? C.muted : C.accent,
                transition: "all 0.15s",
                letterSpacing: 0.2,
              }}
            >
              {phase === "loading" ? "Analyzing…" : "Analyse complète →"}
            </button>
            {runTime !== null ? (
              <span style={{ fontSize: 12, color: C.secondary }}>
                Completed in <span style={{ fontVariantNumeric: "tabular-nums" }}>{runTime}s</span>
              </span>
            ) : (
              <span style={{ fontSize: 12, color: C.muted }}>
                Runs Narrative and Clinical lenses in parallel
              </span>
            )}
          </div>
        </div>

        {/* Loading */}
        {phase === "loading" && (
          <div
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 7,
              padding: 22,
              marginBottom: 40,
            }}
          >
            <style>{`
              @keyframes oa-glow {
                0%, 100% { transform: scale(0.82); opacity: 0.35; }
                50% { transform: scale(1.08); opacity: 1; }
              }
              @keyframes oa-glow-delay {
                0%, 100% { transform: scale(0.82); opacity: 0.35; }
                50% { transform: scale(1.08); opacity: 1; }
              }
            `}</style>

            {/* Lens orbs animation */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              {/* Narrative orb */}
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: C.narrative,
                boxShadow: loadingIdx <= 1 ? `0 0 10px 3px ${C.narrative}55` : "none",
                animation: loadingIdx <= 1 ? "oa-glow 1.3s ease-in-out infinite" : "none",
                opacity: loadingIdx <= 1 ? 1 : 0.25,
                transition: "opacity 0.5s, box-shadow 0.5s",
              }} />
              <div style={{ fontSize: 10, color: C.narrativeDim, fontWeight: 600, letterSpacing: 1 }}>N</div>

              {/* Connector */}
              <div style={{ flex: 1, height: 1, background: C.border, maxWidth: 32 }} />

              {/* Clinical orb */}
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: C.clinical,
                boxShadow: loadingIdx <= 1 ? `0 0 10px 3px ${C.clinical}55` : "none",
                animation: loadingIdx <= 1 ? "oa-glow-delay 1.3s ease-in-out infinite 0.65s" : "none",
                opacity: loadingIdx <= 1 ? 1 : 0.25,
                transition: "opacity 0.5s, box-shadow 0.5s",
              }} />
              <div style={{ fontSize: 10, color: C.clinicalDim, fontWeight: 600, letterSpacing: 1 }}>C</div>

              {/* Connector */}
              <div style={{ flex: 1, height: 1, background: C.border, maxWidth: 32 }} />

              {/* Synthesis orb */}
              <div style={{
                width: 14, height: 14, borderRadius: "50%",
                background: C.accent,
                boxShadow: loadingIdx === 2 ? `0 0 10px 3px ${C.accent}55` : "none",
                animation: loadingIdx === 2 ? "oa-glow 1s ease-in-out infinite" : "none",
                opacity: loadingIdx === 2 ? 1 : 0.2,
                transition: "opacity 0.5s, box-shadow 0.5s",
              }} />
              <div style={{ fontSize: 10, color: C.accentDim, fontWeight: 600, letterSpacing: 1 }}>S</div>
            </div>

            <div style={{ fontSize: 28, fontWeight: 700, color: C.secondary, fontVariantNumeric: "tabular-nums", marginBottom: 16 }}>
              {elapsed}s
            </div>
            {LOADING_MESSAGES.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 0",
                  opacity: i <= loadingIdx ? 1 : 0.25,
                  transition: "opacity 0.5s",
                }}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: i === loadingIdx ? C.accent : i < loadingIdx ? C.muted : C.dim,
                    flexShrink: 0,
                    transition: "background 0.5s",
                  }}
                />
                <span style={{ fontSize: 13, color: i === loadingIdx ? C.text : C.muted }}>
                  {msg}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {phase === "error" && error && (
          <div
            style={{
              background: "#130808",
              border: "1px solid #4a1010",
              borderRadius: 7,
              padding: 14,
              marginBottom: 40,
              fontSize: 13,
              color: "#f87171",
            }}
          >
            Error: {error}
          </div>
        )}

        {/* Bundle nudge — shown after a document run */}
        {phase === "done" && result && dataset === "document" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: C.accentBg,
              border: `1px solid ${C.accentDim}`,
              borderRadius: 8,
              padding: "14px 20px",
              marginBottom: 8,
            }}
          >
            <div>
              <span style={{ fontSize: 13, color: C.secondary }}>
                Document analysis complete.
              </span>
              <span style={{ fontSize: 13, color: C.muted, marginLeft: 8 }}>
                See how OuiDire reasons across multiple documents:
              </span>
            </div>
            <button
              onClick={() => handleDatasetChange("bundle")}
              style={{
                padding: "8px 18px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                border: `1px solid ${C.narrative}`,
                background: "transparent",
                color: C.narrative,
                whiteSpace: "nowrap" as const,
                flexShrink: 0,
                marginLeft: 16,
              }}
            >
              Bundle thesis →
            </button>
          </div>
        )}

        {/* Results — inverted pyramid: Thesis → Clusters → Card reasoning → Cards */}
        {phase === "done" && result && (
          <>
            <Divider />

            {/* 1. Thesis / synthesis — most important, shown first */}
            {result.level === "document" ? (
              <DocumentOverviewSection result={result as DocumentAnalysis} />
            ) : (
              <BundleThesisSection result={result as BundleAnalysis} />
            )}

            <Divider />

            {/* 2. Clusters */}
            <ClustersSection
              narrativeClusters={
                result.level === "document"
                  ? (result as DocumentAnalysis).narrativeClusters
                  : (result as BundleAnalysis).narrativeClusters
              }
              clinicalClusters={
                result.level === "document"
                  ? (result as DocumentAnalysis).clinicalClusters
                  : (result as BundleAnalysis).clinicalClusters
              }
            />

            <Divider />

            {/* 3. Card-level reasoning */}
            <CardReasoningSection
              cards={cards}
              narrativeReasoning={result.narrativeReasoning}
              clinicalReasoning={result.clinicalReasoning}
            />
          </>
        )}

        {/* Cards — raw material, always at bottom */}
        <Divider />
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.8,
                  textTransform: "uppercase" as const,
                  color: C.muted,
                  marginBottom: 4,
                }}
              >
                Source cards
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>
                {cards.length} cards · no pre-assigned macro labels
              </div>
            </div>
            {cards.length > CARDS_PREVIEW && (
              <button
                onClick={() => setShowAllCards((v) => !v)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  border: `1px solid ${C.border}`,
                  background: "transparent",
                  color: C.muted,
                  transition: "all 0.15s",
                }}
              >
                {showAllCards ? "Collapse" : `Show all ${cards.length} cards`}
              </button>
            )}
          </div>
          <CardGrid cards={cards} limit={showAllCards ? undefined : CARDS_PREVIEW} />
          {!showAllCards && cards.length > CARDS_PREVIEW && (
            <div
              style={{
                textAlign: "center" as const,
                marginTop: 16,
                fontSize: 12,
                color: C.muted,
              }}
            >
              Showing {CARDS_PREVIEW} of {cards.length} ·{" "}
              <button
                onClick={() => setShowAllCards(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: C.accent,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: 0,
                }}
              >
                Show all
              </button>
            </div>
          )}
        </div>

        {/* Safety note */}
        <Divider />
        <div style={{ textAlign: "center" as const }}>
          <p style={{ fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.9 }}>
            A public-safe experimental variation on OuiDire&apos;s reasoning workflow.
            <br />
            Synthetic data only · No real patient records · No authentication, billing, or OCR.
            <br />
            <span style={{ color: C.dim }}>
              The full OuiDire platform includes document upload, real-record analysis, user accounts, credits, and production audit workflows.
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}
