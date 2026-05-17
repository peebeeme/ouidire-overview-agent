import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Taxonomy types ───────────────────────────────────────────────────────────

interface MacroDefinition {
  key: string;
  label: string;
  definition: string;
  lookFor: string[];
  avoid: string;
}

interface MacroSet {
  label: string;
  purpose: string;
  macros: MacroDefinition[];
}

interface MacroSets {
  narrative_record_distortion: MacroSet;
  clinical_diagnostic_failure: MacroSet;
}

// ─── Load taxonomy at module init (server-side only) ─────────────────────────

const macroSetsPath = path.join(process.cwd(), "data", "macro_sets.json");
const macroSets: MacroSets = JSON.parse(fs.readFileSync(macroSetsPath, "utf-8"));

function buildGlossaryBlock(set: MacroSet): string {
  return (
    `${set.label.toUpperCase()}\n` +
    `Purpose: ${set.purpose}\n\n` +
    set.macros
      .map((m) => {
        const lookFor = m.lookFor.map((l) => `    • ${l}`).join("\n");
        return (
          `- ${m.key}: ${m.label}\n` +
          `  Definition: ${m.definition}\n` +
          `  Look for:\n${lookFor}\n` +
          `  Avoid: ${m.avoid}`
        );
      })
      .join("\n\n")
  );
}

const NARRATIVE_GLOSSARY = buildGlossaryBlock(macroSets.narrative_record_distortion);
const CLINICAL_GLOSSARY = buildGlossaryBlock(macroSets.clinical_diagnostic_failure);

const NARRATIVE_KEYS = macroSets.narrative_record_distortion.macros.map((m) => m.key);
const CLINICAL_KEYS = macroSets.clinical_diagnostic_failure.macros.map((m) => m.key);

// ─── Public types ─────────────────────────────────────────────────────────────

export type OverviewLevel = "document" | "bundle";

export interface OverviewCard {
  cardId: string;
  documentId?: string;
  documentTitle: string;
  page: number;
  paragraph: number;
  source: string;
  text: string;
}

export interface OverviewRequest {
  level: OverviewLevel;
  documentTitle: string;
  cards: OverviewCard[];
}

export interface CardLensResult {
  cardId: string;
  source: string;
  macrosDetected: string[];
  observation: string;
  rationale: string;
}

export interface ReasoningCluster {
  clusterId: string;
  title: string;
  pattern: string;
  includedCards: string[];
  reasoning: string;
  traceability: string[];
}

export interface DocumentAnalysis {
  level: "document";
  documentTitle: string;
  cardCount: number;
  narrativeReasoning: CardLensResult[];
  clinicalReasoning: CardLensResult[];
  narrativeClusters: ReasoningCluster[];
  clinicalClusters: ReasoningCluster[];
  mechanisms: string[];
  contradictions: string[];
  criticalOmissions: string[];
  summary: string;
  thesis: string;
  traceability: string[];
  generatedAt: string;
}

export interface BundleDocumentSummary {
  documentTitle: string;
  cardCount: number;
  overview: string;
}

export interface BundleAnalysis {
  level: "bundle";
  bundleTitle: string;
  documents: BundleDocumentSummary[];
  narrativeReasoning: CardLensResult[];
  clinicalReasoning: CardLensResult[];
  narrativeClusters: ReasoningCluster[];
  clinicalClusters: ReasoningCluster[];
  crossDocumentPatterns: string[];
  documentContrasts: string[];
  globalThesis: string;
  traceability: string[];
  generatedAt: string;
}

export type OverviewResponse = DocumentAnalysis | BundleAnalysis;

// ─── Prompt builders ──────────────────────────────────────────────────────────

function formatCards(cards: OverviewCard[]): string {
  return cards.map((c) => `[${c.cardId}] [${c.source}] ${c.text}`).join("\n");
}

function buildNarrativeLensPrompt(cards: OverviewCard[]): string {
  const validKeys = NARRATIVE_KEYS.join(", ");
  return `You are an expert analyst in psychiatric and legal record audit, specializing in documentary and narrative distortion.

${NARRATIVE_GLOSSARY}

Analyze the following ${cards.length} cards using ONLY the narrative lens macros defined above.
Valid macro keys: ${validKeys}

For each card, identify which macros (if any) apply, state your observation, and explain why it matters analytically.
Then group cards into clusters where they share the same narrative distortion pattern.

CARDS:
${formatCards(cards)}

Respond with ONLY this JSON object, no preamble or explanation:
{
  "cardReasoning": [
    {
      "cardId": "<card id>",
      "source": "<source reference>",
      "macrosDetected": ["<valid macro key>"],
      "observation": "<one sentence: what you observe in this card through the narrative lens>",
      "rationale": "<one sentence: why this matters analytically, or empty string if no macro detected>"
    }
  ],
  "clusters": [
    {
      "clusterId": "cluster-narrative-<slug>",
      "title": "<short descriptive name for this cluster>",
      "pattern": "<macro key or combined pattern>",
      "includedCards": ["<cardId>"],
      "reasoning": "<why these cards belong together and what the pattern reveals about the record>",
      "traceability": ["<source reference>"]
    }
  ]
}

Rules:
- Return an entry in cardReasoning for EVERY card, even those with no macro detected (macrosDetected: [], observation: "No narrative distortion pattern identified.", rationale: "").
- Only create clusters with at least 2 cards that genuinely share a pattern. Omit clusters if none qualify.
- Use only valid macro keys from: ${validKeys}
- Do not generate legal conclusions or medical diagnoses.
- Respond ONLY with the JSON object.`;
}

function buildClinicalLensPrompt(cards: OverviewCard[]): string {
  const validKeys = CLINICAL_KEYS.join(", ");
  return `You are an expert analyst in psychiatric and legal record audit, specializing in clinical and diagnostic reasoning failures.

${CLINICAL_GLOSSARY}

Analyze the following ${cards.length} cards using ONLY the clinical lens macros defined above.
Valid macro keys: ${validKeys}

For each card, identify which macros (if any) apply, state your observation, and explain why it matters analytically.
Then group cards into clusters where they share the same clinical failure pattern.

CARDS:
${formatCards(cards)}

Respond with ONLY this JSON object, no preamble or explanation:
{
  "cardReasoning": [
    {
      "cardId": "<card id>",
      "source": "<source reference>",
      "macrosDetected": ["<valid macro key>"],
      "observation": "<one sentence: what you observe in this card through the clinical lens>",
      "rationale": "<one sentence: why this matters analytically, or empty string if no macro detected>"
    }
  ],
  "clusters": [
    {
      "clusterId": "cluster-clinical-<slug>",
      "title": "<short descriptive name for this cluster>",
      "pattern": "<macro key or combined pattern>",
      "includedCards": ["<cardId>"],
      "reasoning": "<why these cards belong together and what the pattern reveals about the clinical reasoning>",
      "traceability": ["<source reference>"]
    }
  ]
}

Rules:
- Return an entry in cardReasoning for EVERY card, even those with no macro detected (macrosDetected: [], observation: "No clinical failure pattern identified.", rationale: "").
- Only create clusters with at least 2 cards that genuinely share a pattern. Omit clusters if none qualify.
- Use only valid macro keys from: ${validKeys}
- Do not generate legal conclusions or medical diagnoses.
- Respond ONLY with the JSON object.`;
}

function buildDocumentSynthesisPrompt(
  title: string,
  narrativeResult: { cardReasoning: CardLensResult[]; clusters: ReasoningCluster[] },
  clinicalResult: { cardReasoning: CardLensResult[]; clusters: ReasoningCluster[] }
): string {
  const narrativeFindings = narrativeResult.cardReasoning
    .filter((c) => c.macrosDetected.length > 0)
    .map((c) => `[${c.cardId}] ${c.macrosDetected.join(", ")}: ${c.observation}`)
    .join("\n") || "No narrative distortion patterns identified.";

  const clinicalFindings = clinicalResult.cardReasoning
    .filter((c) => c.macrosDetected.length > 0)
    .map((c) => `[${c.cardId}] ${c.macrosDetected.join(", ")}: ${c.observation}`)
    .join("\n") || "No clinical failure patterns identified.";

  const narrativeClusters = narrativeResult.clusters
    .map((cl) => `- [${cl.pattern}] ${cl.title}: ${cl.reasoning}`)
    .join("\n") || "No narrative clusters.";

  const clinicalClusters = clinicalResult.clusters
    .map((cl) => `- [${cl.pattern}] ${cl.title}: ${cl.reasoning}`)
    .join("\n") || "No clinical clusters.";

  return `You are an expert analyst in psychiatric and legal record audit.

Based on the following two-lens analysis of the document titled "${title}", produce a document-level analytical synthesis integrating both the narrative/record distortion perspective and the clinical/diagnostic failure perspective.

NARRATIVE LENS FINDINGS:
${narrativeFindings}

NARRATIVE CLUSTERS:
${narrativeClusters}

CLINICAL LENS FINDINGS:
${clinicalFindings}

CLINICAL CLUSTERS:
${clinicalClusters}

Produce a document-level synthesis with this exact JSON structure:
{
  "mechanisms": ["<3 to 5 dominant analytical patterns integrating both lenses, each in one complete sentence>"],
  "contradictions": ["<notable internal contradictions found in the record, or empty array if none>"],
  "criticalOmissions": ["<key missing facts, evidence, or assessments that are materially relevant to the conclusions drawn, or empty array if none>"],
  "summary": "<2 to 3 sentence plain-language synthesis of this document's analytical profile>",
  "thesis": "<one sentence: the core analytical thesis — what this document, taken as a whole, does to the record>",
  "traceability": ["<specific source references that support the thesis, e.g. 'p. 2, par. 13', 'p. 3, par. 26'>"]
}

Rules:
- Integrate both lenses into a coherent analytical picture; do not simply list findings from each lens separately.
- The thesis must be a single, specific, falsifiable statement about what this document accomplishes analytically.
- Stay factual. Do not generate legal conclusions or medical diagnoses.
- Respond ONLY with the JSON object.`;
}

function buildBundleSynthesisPrompt(
  bundleTitle: string,
  cards: OverviewCard[],
  narrativeResult: { cardReasoning: CardLensResult[]; clusters: ReasoningCluster[] },
  clinicalResult: { cardReasoning: CardLensResult[]; clusters: ReasoningCluster[] }
): string {
  const docGroups = new Map<string, number>();
  for (const card of cards) {
    docGroups.set(card.documentTitle, (docGroups.get(card.documentTitle) ?? 0) + 1);
  }
  const docSummaries = Array.from(docGroups.entries())
    .map(([title, count]) => `- "${title}" (${count} cards)`)
    .join("\n");

  const cardDocMap = new Map(cards.map((c) => [c.cardId, c.documentTitle]));

  const narrativeFindings = narrativeResult.cardReasoning
    .filter((c) => c.macrosDetected.length > 0)
    .map((c) => `[${c.cardId}][${cardDocMap.get(c.cardId) ?? ""}] ${c.macrosDetected.join(", ")}: ${c.observation}`)
    .join("\n") || "No narrative distortion patterns identified.";

  const clinicalFindings = clinicalResult.cardReasoning
    .filter((c) => c.macrosDetected.length > 0)
    .map((c) => `[${c.cardId}][${cardDocMap.get(c.cardId) ?? ""}] ${c.macrosDetected.join(", ")}: ${c.observation}`)
    .join("\n") || "No clinical failure patterns identified.";

  return `You are an expert analyst in psychiatric and legal record audit.

Bundle: "${bundleTitle}"
Documents analyzed:
${docSummaries}

Based on two-lens analysis of this bundle, synthesize cross-document patterns. Focus specifically on what changes, disappears, or is amplified as you move from earlier documents to later ones.

NARRATIVE LENS FINDINGS (with document attribution):
${narrativeFindings}

CLINICAL LENS FINDINGS (with document attribution):
${clinicalFindings}

Produce a bundle-level synthesis with this exact JSON structure:
{
  "documents": [
    {
      "documentTitle": "<exact document title>",
      "cardCount": <number>,
      "overview": "<2 sentence analytical profile of this document's role in the bundle>"
    }
  ],
  "crossDocumentPatterns": ["<patterns that persist or are amplified across multiple documents, each in one sentence>"],
  "documentContrasts": ["<ways later documents diverge from, contradict, or omit what earlier documents established — each in one sentence>"],
  "globalThesis": "<one sentence: the core analytical thesis about this bundle read as a whole>",
  "traceability": ["<specific source references supporting the global thesis>"]
}

Rules:
- Focus on what changes between documents, not just what each document contains.
- Identify if allegations or characterizations from earlier documents are recycled later without re-verification.
- Note stabilizing evidence from earlier documents that disappears in later ones.
- Stay factual. Do not generate legal conclusions or medical diagnoses.
- Respond ONLY with the JSON object.`;
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function extractJsonObject(raw: string): string {
  const start = raw.indexOf("{");
  if (start === -1) throw new Error("Gemini response did not contain valid JSON");
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) return raw.slice(start, i + 1); }
    }
  }
  throw new Error("Gemini response JSON was not properly closed");
}

function parseJsonFromResponse<T>(raw: string): T {
  return JSON.parse(extractJsonObject(stripFences(raw))) as T;
}

function normalizeLensResult(
  parsed: unknown,
  cards: OverviewCard[]
): { cardReasoning: CardLensResult[]; clusters: ReasoningCluster[] } {
  const p = parsed as { cardReasoning?: unknown; clusters?: unknown };

  const cardReasoning: CardLensResult[] = Array.isArray(p.cardReasoning)
    ? (p.cardReasoning as CardLensResult[]).map((r) => ({
        cardId: String(r.cardId ?? ""),
        source: String(r.source ?? ""),
        macrosDetected: Array.isArray(r.macrosDetected) ? r.macrosDetected.map(String) : [],
        observation: String(r.observation ?? ""),
        rationale: String(r.rationale ?? ""),
      }))
    : cards.map((c) => ({
        cardId: c.cardId,
        source: c.source,
        macrosDetected: [],
        observation: "",
        rationale: "",
      }));

  const clusters: ReasoningCluster[] = Array.isArray(p.clusters)
    ? (p.clusters as ReasoningCluster[]).map((cl) => ({
        clusterId: String(cl.clusterId ?? ""),
        title: String(cl.title ?? ""),
        pattern: String(cl.pattern ?? ""),
        includedCards: Array.isArray(cl.includedCards) ? cl.includedCards.map(String) : [],
        reasoning: String(cl.reasoning ?? ""),
        traceability: Array.isArray(cl.traceability) ? cl.traceability.map(String) : [],
      }))
    : [];

  return { cardReasoning, clusters };
}

// ─── 503 fallback helper ──────────────────────────────────────────────────────

function is503(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("overloaded") ||
    msg.includes("service unavailable") ||
    msg.includes("high demand")
  );
}

async function generate(
  genAI: GoogleGenerativeAI,
  primary: string,
  fallback: string,
  prompt: string
): Promise<string> {
  try {
    const r = await genAI.getGenerativeModel({ model: primary }).generateContent(prompt);
    return r.response.text().trim();
  } catch (err) {
    if (!is503(err)) throw err;
    const r = await genAI.getGenerativeModel({ model: fallback }).generateContent(prompt);
    return r.response.text().trim();
  }
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

// ─── Main agent function ──────────────────────────────────────────────────────

export async function runOverviewAgent(req: OverviewRequest): Promise<OverviewResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const maxCards = parseInt(process.env.OVERVIEW_MAX_CARDS ?? "50", 10);
  const primaryModel = process.env.OVERVIEW_MODEL ?? "gemini-3.1-flash-lite";
  const fallbackModel = "gemini-2.5-flash";

  const cards = req.cards.slice(0, maxCards);

  const genAI = new GoogleGenerativeAI(apiKey);

  async function call(prompt: string): Promise<string> {
    const raw = await generate(genAI, primaryModel, fallbackModel, prompt);
    try { parseJsonFromResponse(raw); } catch { return generate(genAI, primaryModel, fallbackModel, prompt); }
    return raw;
  }

  // Double run: both lenses in parallel, each with 503 fallback + parse retry
  const [narrativeRaw, clinicalRaw] = await Promise.all([
    call(buildNarrativeLensPrompt(cards)),
    call(buildClinicalLensPrompt(cards)),
  ]);

  const narrativeResult = normalizeLensResult(parseJsonFromResponse(narrativeRaw), cards);
  const clinicalResult = normalizeLensResult(parseJsonFromResponse(clinicalRaw), cards);

  if (req.level === "document") {
    const synthRaw = await call(
      buildDocumentSynthesisPrompt(req.documentTitle, narrativeResult, clinicalResult)
    );

    const synth = parseJsonFromResponse<{
      mechanisms?: unknown;
      contradictions?: unknown;
      criticalOmissions?: unknown;
      summary?: unknown;
      thesis?: unknown;
      traceability?: unknown;
    }>(synthRaw);

    return {
      level: "document",
      documentTitle: req.documentTitle,
      cardCount: cards.length,
      narrativeReasoning: narrativeResult.cardReasoning,
      clinicalReasoning: clinicalResult.cardReasoning,
      narrativeClusters: narrativeResult.clusters,
      clinicalClusters: clinicalResult.clusters,
      mechanisms: Array.isArray(synth.mechanisms) ? synth.mechanisms.map(String) : [],
      contradictions: Array.isArray(synth.contradictions) ? synth.contradictions.map(String) : [],
      criticalOmissions: Array.isArray(synth.criticalOmissions) ? synth.criticalOmissions.map(String) : [],
      summary: typeof synth.summary === "string" ? synth.summary : "",
      thesis: typeof synth.thesis === "string" ? synth.thesis : "",
      traceability: Array.isArray(synth.traceability) ? synth.traceability.map(String) : [],
      generatedAt: new Date().toISOString(),
    };
  } else {
    const synthRaw = await call(
      buildBundleSynthesisPrompt(req.documentTitle, cards, narrativeResult, clinicalResult)
    );

    const synth = parseJsonFromResponse<{
      documents?: unknown;
      crossDocumentPatterns?: unknown;
      documentContrasts?: unknown;
      globalThesis?: unknown;
      traceability?: unknown;
    }>(synthRaw);

    const documents = Array.isArray(synth.documents)
      ? (synth.documents as { documentTitle?: unknown; cardCount?: unknown; overview?: unknown }[]).map((d) => ({
          documentTitle: String(d.documentTitle ?? ""),
          cardCount: typeof d.cardCount === "number" ? d.cardCount : 0,
          overview: String(d.overview ?? ""),
        }))
      : [];

    return {
      level: "bundle",
      bundleTitle: req.documentTitle,
      documents,
      narrativeReasoning: narrativeResult.cardReasoning,
      clinicalReasoning: clinicalResult.cardReasoning,
      narrativeClusters: narrativeResult.clusters,
      clinicalClusters: clinicalResult.clusters,
      crossDocumentPatterns: Array.isArray(synth.crossDocumentPatterns)
        ? synth.crossDocumentPatterns.map(String)
        : [],
      documentContrasts: Array.isArray(synth.documentContrasts) ? synth.documentContrasts.map(String) : [],
      globalThesis: typeof synth.globalThesis === "string" ? synth.globalThesis : "",
      traceability: Array.isArray(synth.traceability) ? synth.traceability.map(String) : [],
      generatedAt: new Date().toISOString(),
    };
  }
}
