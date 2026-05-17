# Sample Data — OuiDire Overview Agent

All data in this directory is **entirely synthetic and anonymized**.

No real patient names, no real case numbers, no real institutions. Fictional scenarios constructed to demonstrate the analytical patterns OuiDire is designed to detect.

## Card Format

```json
{
  "id": "card_001",
  "text": "The full text of the assertion or documented fact.",
  "source": "DocumentName, p.X, par.Y",
  "macros": ["RAP", "critical_omission"],
  "humanNote": "Optional human annotation, or null"
}
```

## Macro Reference

| Macro | Meaning |
|-------|---------|
| `RAP` | Recycled Allegation Pattern — allegation reused from an earlier document without independent verification |
| `critical_omission` | A material fact is absent from the record |
| `narrative_drift` | The description of an event changes across documents |
| `extrapolation` | A conclusion exceeds what the source material supports |
| `biographical_rewriting` | Personal history reformulated in ways that diverge from earlier documentation |
| `source_confusion` | Citation is unclear, mixed, or misattributed |

## Files

- `sample_document_oas.json` — 20 cards from a fictional Authorized Care Order application (document-level demo)
- `sample_bundle_two_docs.json` — 25 cards across two fictional documents: initial 2021 application + 2024 renewal (bundle-level demo)
