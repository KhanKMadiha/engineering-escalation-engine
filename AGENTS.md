# Engineering Escalation Engine

## Project purpose

Build an AI-native support operations platform that helps technical support teams investigate customer issues, determine whether engineering escalation is warranted, generate structured engineering handoffs, and capture resolution feedback.

## Product principles

1. The system must support human decision-making, not blindly replace it.
2. AI recommendations must include evidence and reasoning.
3. Never invent technical evidence.
4. Clearly distinguish customer-provided information from AI inference.
5. Escalation decisions must be explainable.
6. Prefer simple, maintainable architecture over unnecessary complexity.
7. Build production-quality code rather than a prototype disguised as production software.

## Technical principles

- Use TypeScript.
- Use React/Next.js.
- Keep components modular.
- Keep business logic separate from UI.
- Validate API inputs.
- Never expose API keys in client-side code.
- Use environment variables for secrets.
- Write tests for core escalation logic.
- Use structured AI outputs rather than parsing arbitrary prose.
- Keep database logic separate from presentation logic.

## AI principles

The AI should:

- analyse support cases
- classify severity
- identify missing evidence
- assess escalation readiness
- recommend escalation or continued investigation
- explain its recommendation
- generate engineering handoffs

The AI must not:

- fabricate logs
- fabricate request IDs
- claim a root cause without evidence
- automatically escalate a case without human approval

## UX

The interface should feel like an internal enterprise support operations tool.

Prioritise:

- clarity
- information hierarchy
- technical credibility
- concise language
- useful dashboards
- accessible interactions

Avoid:

- excessive animations
- gimmicky AI interfaces
- unnecessary gradients
- generic chatbot styling

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
