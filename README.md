# OuiDire — Overview Agent

**Google AI Agents Challenge — Track 2: Optimize Existing Agents**

OuiDire is a document audit platform that helps users analyze psychiatric and legal records, identify narrative flaws, and generate structured, traceable findings.

This repository demonstrates the **Overview Agent** — a new capability that extends OuiDire from card-level analysis to document-level and bundle-level synthesis using Gemini.

---

## The Problem

Psychiatric and legal records are long, dense, and hard to audit manually.

OuiDire already turns these records into structured analytical cards — one assertion per card, with source citations and macro annotations (e.g., *Recycled Allegation Pattern*, *Critical Omission*, *Narrative Drift*), before any Gemini analysis.

But cards are atoms. Users also need molecules.

> What is the dominant pattern across this document?
> How do two documents contradict each other?
> What is the global thesis of this case?

The Overview Agent answers these questions.

---

## What the Overview Agent Does

**Input:** A set of OuiDire analytical cards (from one document or a bundle of documents).

**Processing:** Two analytical lenses run in parallel, each powered by Gemini:

- **Narrative lens** — detects record distortion patterns (recycled allegations, narrative drift, critical omissions)
- **Clinical lens** — detects diagnostic reasoning failures (unverified diagnostic escalation, contradicted clinical claims)

A third synthesis call integrates both lenses into a document- or bundle-level conclusion.

**Output:**
- Per-card macro detection with rationale
- Reasoning clusters grouping cards that share a pattern
- Dominant mechanisms, contradictions, critical omissions
- Plain-language summary
- A single analytical **thesis** — one falsifiable statement about what this document does to the record
- Traceability references back to source pages and paragraphs

**Design principle:** *Not the machinery, the path.*
The user sees cards → clusters → thesis, not the Gemini calls.

---

## Architecture

```
OuiDire cards (structured JSON)
        ↓
lib/overviewAgent.ts
  ├── Narrative Lens (Gemini) ──┐
  └── Clinical Lens  (Gemini) ──┤  [parallel]
                                ↓
                      Synthesis (Gemini)
                                ↓
              DocumentAnalysis | BundleAnalysis
                                ↓
                        OverviewPanel UI
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full diagram and API contract.

---

## Two Levels of Analysis

| Level | Input | Key outputs |
|-------|-------|-------------|
| **Document** | All cards from one document | Mechanisms, clusters, thesis, traceability |
| **Bundle** | Cards from multiple documents | Cross-document patterns, document contrasts, global thesis |

---

## Running the Demo

### Prerequisites

- Node.js 18+
- A Gemini API key ([get one free at Google AI Studio](https://aistudio.google.com/))

### Setup

```bash
cd ouidire-overview-agent
npm install
cp .env.example .env.local
# Add your GEMINI_API_KEY to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Try the API directly

```bash
curl -X POST http://localhost:3000/api/overview \
  -H "Content-Type: application/json" \
  -d @data/sample/sample_document_oas_clean.json
```

---

## Sample Data

The `data/sample/` directory contains anonymized synthetic cards in OuiDire format.

- `sample_document_oas_clean.json` — 20 cards from a fictional Demande/OAS document
- `sample_bundle_two_docs_clean.json` — 35 cards across two fictional documents (bundle demo)

No real patient data is used anywhere in this repository.

---

## Key Design Decisions

**Isolated, reversible, production-safe.** The Overview Agent lives entirely in `app/api/overview/` and `lib/overviewAgent.ts`. It does not touch OuiDire's existing OCR pipeline, card generation, Gemini run logic, or export system.

**Macros are detected, not passed in.** Cards carry text and source references only. The agent applies its own macro taxonomy (loaded from `data/macro_sets.json`) — meaning the analysis is reproducible and not dependent on upstream tagging.

**Two lenses, not one.** Narrative and clinical failures are structurally different. Running them as separate prompts with separate glossaries produces sharper, less generic findings than a single combined prompt.

**Human remains the final oracle.** The Overview Agent produces suggestions. It does not replace human judgment, confirm findings, or generate exportable conclusions automatically.

**503 resilience.** Each Gemini call falls back to `gemini-2.5-flash` on service overload, with a JSON parse retry before surfacing an error.

---

## Tech Stack

- Next.js 16 (App Router)
- Gemini via `@google/generative-ai` (model configurable via `OVERVIEW_MODEL`, default: `gemini-3.1-flash-lite`, fallback: `gemini-2.5-flash`)
- TypeScript

---

## About OuiDire

OuiDire is built by [Studiorium](https://studiorium.ai) to help people make dense psychiatric and legal records answerable — under conditions of pressure, exhaustion, and institutional imbalance.

OuiDire is not a generic document chatbot. It is a structured audit environment where AI helps surface flaws, but humans remain the final oracle.

---

*Submitted to the Google AI Agents Challenge, June 2026.*
