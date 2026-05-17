# Overview Agent — Architecture

## Full Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         OuiDire Platform                         │
│                                                                  │
│  Documents / Photos                                              │
│       ↓                                                          │
│  OCR (Azure Document Intelligence)                               │
│       ↓                                                          │
│  Card Generation                                                 │
│  ┌────────────────────────────────────────────┐                 │
│  │  Card: "Le patient présente une agitation   │                 │
│  │  psychomotrice selon l'évaluation du        │                 │
│  │  12 mars. [Demande, p.2, par.6]"            │                 │
│  └────────────────────────────────────────────┘                 │
│       ↓ (×N cards)                                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              OVERVIEW AGENT  (NEW)                        │   │
│  │                                                           │   │
│  │  Input: cards[] + level (document | bundle)               │   │
│  │  Macro taxonomy loaded from data/macro_sets.json          │   │
│  │                                                           │   │
│  │  lib/overviewAgent.ts                                     │   │
│  │                                                           │   │
│  │  Step 1 — dual lens (parallel)                            │   │
│  │    ├── Narrative lens → Gemini (record distortion)        │   │
│  │    └── Clinical lens  → Gemini (diagnostic failure)       │   │
│  │         ↓ per-card macro detection + reasoning clusters   │   │
│  │                                                           │   │
│  │  Step 2 — synthesis                                       │   │
│  │    └── Synthesis call → Gemini                            │   │
│  │         ↓ mechanisms, contradictions, criticalOmissions,  │   │
│  │           summary, thesis, traceability                   │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│       ↓                                                          │
│  OverviewPanel UI                                                │
│  "Voir la vue d'ensemble →"                                      │
│                                                                  │
│  Human validates / annotates / exports                           │
└─────────────────────────────────────────────────────────────────┘
```

## Isolation Boundary

The Overview Agent is fully isolated from the existing OuiDire pipeline.

```
Existing pipeline (unchanged):
  OCR → Cards → Gemini run → Human validation → DCR → Export

Overview Agent (new, parallel):
  Cards → overviewAgent.ts → Gemini (×3) → OverviewPanel
```

No shared state. No modification of existing routes. Fully reversible.

## API Contract

### Request

```
POST /api/overview
Content-Type: application/json

{
  "level": "document" | "bundle",
  "documentTitle": string,
  "cards": [
    {
      "cardId": string,
      "documentId": string,          // optional, used for bundle attribution
      "documentTitle": string,
      "page": number,
      "paragraph": number,
      "source": string,              // e.g. "Demande, p.2, par.6"
      "text": string
    }
  ]
}
```

Note: cards carry **no macros**. Macro detection is performed by the agent against its taxonomy.

### Response — Document level

```json
{
  "level": "document",
  "documentTitle": "...",
  "cardCount": 20,
  "narrativeReasoning": [
    {
      "cardId": "...",
      "source": "p.2, par.6",
      "macrosDetected": ["RAP"],
      "observation": "...",
      "rationale": "..."
    }
  ],
  "clinicalReasoning": [ ... ],
  "narrativeClusters": [
    {
      "clusterId": "cluster-narrative-rap",
      "title": "...",
      "pattern": "RAP",
      "includedCards": ["card-01", "card-07"],
      "reasoning": "...",
      "traceability": ["p.2, par.6", "p.5, par.13"]
    }
  ],
  "clinicalClusters": [ ... ],
  "mechanisms": ["...", "...", "..."],
  "contradictions": ["..."],
  "criticalOmissions": ["..."],
  "summary": "2–3 sentence plain-language synthesis.",
  "thesis": "One falsifiable statement about what this document does to the record.",
  "traceability": ["p.2, par.6", "p.3, par.11"],
  "generatedAt": "2026-05-17T..."
}
```

### Response — Bundle level

```json
{
  "level": "bundle",
  "bundleTitle": "...",
  "documents": [
    { "documentTitle": "...", "cardCount": 20, "overview": "..." }
  ],
  "narrativeReasoning": [ ... ],
  "clinicalReasoning": [ ... ],
  "crossDocumentPatterns": ["..."],
  "documentContrasts": ["..."],
  "globalThesis": "One sentence about the bundle as a whole.",
  "traceability": ["..."],
  "generatedAt": "2026-05-17T..."
}
```

## Reliability

Each Gemini call uses a two-stage fallback:

1. Primary model (`OVERVIEW_MODEL`, default `gemini-3.1-flash-lite`)
2. On 503 / service overload → fallback to `gemini-2.5-flash`
3. On JSON parse failure → one retry before surfacing an error

## Environment Variables

```
GEMINI_API_KEY=              # Required
OVERVIEW_MODEL=gemini-3.1-flash-lite   # Optional (default)
OVERVIEW_MAX_CARDS=50        # Optional (default: 50)
```

## Data Flow — Bundle Level

```
Document A cards ──┐
                   ├── Narrative Lens (Gemini) ──┐
Document B cards ──┤                             ├── Synthesis (Gemini)
                   └── Clinical Lens  (Gemini) ──┘
                                                  ↓
                                         BundleAnalysis
                                           crossDocumentPatterns
                                           documentContrasts
                                           globalThesis
                                           traceability
```
