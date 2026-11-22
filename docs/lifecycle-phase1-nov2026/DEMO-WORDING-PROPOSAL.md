# Proposed demo wording simplification (approval required)

**Do not apply hosted updates until wording is approved.**  
Scope: clearer Support-ticket voice across all ten fictional cases. No severity, score, recommendation, reproduction-result, or technical-evidence body changes.

`[DEMO]` markers remain in storage; UI strips them for display.

---

## Apply surface map

| Surface | What must change for consistency |
|---------|----------------------------------|
| Seed fixtures (`demo-cases.ts`, `demo-cases-additional.ts`) | Titles + customer-facing prose fields (description, behaviour, troubleshooting where noted) |
| Hosted `support_cases` | Same fields for all ten case IDs (narrow UPDATEs; no reseed) |
| Hosted `engineering_handoffs` | **Escalated cases only** — snapshot `title` / `summary` / `actual_behaviour` (and related prose) so Create escalation + Jira/Rootly stay aligned |
| Historical `human_decisions.rationale` | **Leave intact** unless separately approved (Vertex rationale already corrected) |
| AI `case_analyses` / `escalation_results` | **Do not rewrite** scores or recommendations. If description excerpts used in stored analysis text drift, leave historical analysis as-is; update seed analysis `quotedExcerpt` only as needed for future local seeds |
| Presentation-only | None for this pass — wording lives in case/handoff data that UI already renders |

---

## 1. Titles — Before → After

| # | Case | Before | After |
|---|------|--------|-------|
| 1 | Northstar Financial | Intermittent 500 errors when retrieving articles through API v3 | Intermittent HTTP 500 errors retrieving articles via API v3 |
| 2 | Meridian Systems | SSO authentication fails after identity provider certificate rotation | SSO login fails for some users after IdP certificate rotation |
| 3 | Apex Digital | MS Teams Auto-Answer fails to respond in public channels | MS Teams Auto-Answer not responding in public channels |
| 4 | Helix Analytics | Enterprise search fails to index newly published articles | New articles not appearing in Enterprise Search |
| 5 | Cascade Retail | Slack integration fails to deliver channel notifications | Slack channel notifications not delivering |
| 6 | Summit Workforce | SCIM user provisioning fails for a subset of new hires | SCIM not provisioning some new users |
| 7 | Blue Harbor Logistics | API clients receive intermittent HTTP 429 rate-limit responses | Intermittent HTTP 429 rate-limit responses from API v3 |
| 8 | Orchid Health | SAML authentication fails for a subset of enterprise users | SAML SSO failing for a subset of users |
| 9 | Brightline Insurance | Email notifications fail to deliver for password-reset messages | Password-reset emails intermittently not delivering |
| 10 | **Vertex Media** | Intermittent HTTP 504 gateway timeouts under peak load | **Intermittent HTTP 504 Gateway Timeout Errors** |

---

## 2. Issue descriptions — Before → After (substantial)

| Case | Before (summary) | After |
|------|------------------|-------|
| Northstar | Multi-line formal narrative + status/request ID/timestamp | Customers intermittently get HTTP 500 when retrieving articles via API v3 in prod. Request ID: req-demo-48291. |
| Meridian | Speculates config vs defect; “evidence incomplete” boilerplate | Some users cannot complete SSO login after a recent IdP certificate rotation. Full SAML failure package not yet collected. |
| Apex | Mentions premature escalation | Auto-Answer works in some private channels but does not respond in public channels. Still checking channel permissions / bot membership. |
| Helix | Formal critical-impact language | New articles stay missing from Enterprise Search for hours after publish. Indexer logs show failures (req-demo-search-1182). |
| Cascade | Formal webhook wording | Slack notifications are not reaching configured channels. Delivery logs show HTTP 500 `slack_delivery_failed` (req-demo-slack-7741). |
| Summit | Speculates mapping/filter | Some new IdP users never appear in the product directory after SCIM sync. Complete SCIM request/response pairs not yet available. |
| Blue Harbor | “peak ingestion windows” + belief about quotas | API clients intermittently receive HTTP 429 in prod. Need to confirm quota headers and client retry/backoff before escalating. |
| Orchid | Formal subset wording | Some users fail SAML SSO while peers on the same IdP succeed. Captured error: Signature validation failed (req-demo-saml-5520). |
| Brightline | Formal intermittent delivery | Password-reset / security emails intermittently never arrive. Partial SMTP deferrals seen; full bounce packages still needed. |
| **Vertex** | Peak traffic / latency correlation narrative | **API requests intermittently return HTTP 504 errors in prod.** |

---

## 3. Related prose to align (same apply pass)

Keep technical evidence (`logsErrors`, request IDs, latency samples) unchanged. Soften only customer-facing / support narrative fields:

| Case | Fields to simplify (examples) |
|------|-------------------------------|
| Vertex | `actualBehaviour`: drop “during peak load”; keep elevated upstream latency where observed. `troubleshootingPerformed`: “Reproduced in prod”; keep latency comparison notes. `stepsToReproduce`: remove “peak traffic window”. `issueFirstObserved`: drop “evening peaks” → e.g. “Week of 27 Oct 2026”. |
| Blue Harbor | Drop “peak windows” from description / actualBehaviour / first-observed; keep HTTP 429 + headers. |
| All | Prefer “prod” in natural sentences; leave `environment: "production"` enum unchanged. Avoid repeating the title inside the description. |

**Do not change** stored approval rationales in this pass (Apex / Northstar / Helix / Cascade / Brightline / Blue Harbor / Vertex).

---

## 4. Hosted case IDs (for later approved UPDATEs)

| Key | Hosted case ID | Also update handoff snapshot? |
|-----|----------------|-------------------------------|
| clear_escalation | `52144e0c-9797-4e5d-8097-551fc644dd63` | Yes |
| insufficient_evidence | `997f45ad-f686-4724-a3c1-094d659a3741` | No |
| continue_investigation | `7f613c76-952c-48bb-af67-20ff9de73163` | No |
| search_indexing | `dc10c410-3a18-41b1-8f7c-07cd292e11a5` | Yes |
| slack_notifications | `0138f515-69b6-4651-8ae2-60ff18188095` | Yes |
| scim_provisioning | `4218ff91-8030-4b69-b7fa-aaa95de3f242` | No |
| api_rate_limit | `caec85c1-b53a-4a64-aa80-a5fdcca7e4b8` | No |
| saml_subset_users | `ea1437f9-588f-418b-8222-c11079d246c2` | No (no handoff yet) |
| email_delivery | `cba189e2-a487-46d1-97db-0f5e21d7b2a1` | No |
| http_504_latency | `b04a05d3-9bbb-45c2-8abc-43b2f70bcd15` | Yes (title/summary/behaviour; keep corrected decision rationale) |

---

## 5. Explicitly out of scope for this wording pass

- Severity, scores, recommendations, lifecycle status reconciliation
- Technical evidence artefact bodies (latency timings, request IDs, traces)
- UI redesign
- Reseed / delete-recreate
- Changing historical decision outcomes or timestamps
