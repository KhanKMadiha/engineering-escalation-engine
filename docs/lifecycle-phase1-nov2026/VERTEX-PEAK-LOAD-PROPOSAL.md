# Proposed Vertex peak-load wording correction (approval required)

**Do not modify hosted title/description fields without separate approval.**  
This is separate from the completed rationale correction.

## Finding

“Under peak load” / “peak traffic window” / “peak window” appear as narrative labels in the Vertex (`http_504_latency`) fixture and hosted case. Recorded technical evidence supports intermittent HTTP 504s and elevated upstream latency (~30s / `upstream_duration_ms: 30112`), but **no traffic-volume metrics** (RPS, concurrency, capacity charts) establish peak load.

## Occurrences to review (fixture + hosted text)

| Location | Current wording (representative) | Proposed evidence-based replacement |
|----------|----------------------------------|-------------------------------------|
| `issueTitle` | Intermittent HTTP 504 gateway timeouts **under peak load** | Intermittent HTTP 504 gateway timeouts **with elevated upstream latency** |
| `issueDescription` | …during **peak traffic windows** | …**intermittently** / with elevated upstream latency |
| `stepsToReproduce` step 2 | …during a **peak traffic window** | …with **repeated requests** (keep reproduction intent; drop peak claim) |
| `actualBehaviour` | …during **peak load** | …with **elevated upstream latency** |
| `troubleshootingPerformed` | …during a **peak window** | …**in production** |
| AI reasoning / suspected root cause (assessment snapshot) | under peak load | Prefer latency/timeout language; keep “inference; not proven” |
| Technical evidence title | Postman **peak-load** sample | Postman **latency** sample (label only) |

## Rules

- Do not invent request volumes, peak timestamps, or causal explanations.
- Do not change scores, recommendation, approval, or handoff identity.
- Prefer customer-reported narrative only where clearly labelled as such; otherwise use latency-backed wording.

## Suggested apply order (when approved)

1. Update hosted `support_cases` title/description/behaviour/troubleshooting fields for case `b04a05d3-9bbb-45c2-8abc-43b2f70bcd15` only.
2. Align seed fixture `http_504_latency` in `demo-cases-additional.ts` for future reseeds.
3. Optionally refresh handoff title/summary text if it still embeds “peak load” (separate from `decision_rationale`, already corrected).
4. Append an audit note describing the wording correction.
