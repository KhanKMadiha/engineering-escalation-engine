import { Card } from "@/components/ui/Card";

const SECTIONS = [
  {
    title: "Case intake and ticket import",
    body: "Support engineers create cases manually or import from Freshdesk when configured. Customer-provided fields — issue description, expected and actual behaviour, troubleshooting and evidence — are captured without inventing technical details.",
  },
  {
    title: "Investigation and evidence sources",
    body: "The Investigation section presents intake and investigation fields as customer or support-provided. Technical evidence (logs, correlation references, timestamps) is shown when present on the case. AI-derived fields such as reproducibility are labelled separately so reviewers can distinguish inference from verified input. Missing-evidence lists come from analysis results and do not invent new artefacts.",
  },
  {
    title: "AI-assisted evidence analysis",
    body: "Structured AI analysis assesses severity, reproducibility, missing evidence and suspected product defect signals. Evidence identified by the model is validated against case fields before use. AI output is labelled and advisory. The system does not fabricate logs, request IDs or root causes.",
  },
  {
    title: "Deterministic escalation scoring",
    body: "An escalation engine applies fixed rules and weights to produce a score and recommendation (escalate, continue investigation, or insufficient evidence). Thresholds and scoring logic are deterministic and auditable.",
  },
  {
    title: "Human review and approval",
    body: "When a case awaits decision, an authorised reviewer must approve escalation or continue investigation. AI recommendations never escalate a case automatically. The human reviewer retains final decision authority.",
  },
  {
    title: "Engineering handoff generation",
    body: "After human approval, the system generates a structured Engineering handoff from existing case, analysis and decision data. Downstream demo actions (for example Jira or Rootly) do not bypass approval gates.",
  },
  {
    title: "Audit history",
    body: "Case events record intake, analysis, scoring, human decisions and handoff creation. Timeline and Activity views surface these persisted events only — they do not invent history.",
  },
] as const;

/**
 * Explanatory resource page — presentation only; describes confirmed behaviour.
 */
export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          How it works
        </h1>
        <p className="text-[15px] text-muted">
          The Engineering Escalation Engine helps Support Operations investigate
          customer issues, decide whether Engineering escalation is warranted,
          and produce structured handoffs — with humans in control of the final
          decision.
        </p>
      </div>

      <Card padding="lg" className="border-border bg-subtle/40">
        <h2 className="text-base font-semibold text-foreground">
          AI is advisory
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          AI analysis and escalation recommendations inform the reviewer. They
          do not replace human judgement. Escalation to Engineering requires
          explicit human approval. Evidence shown in the product is either
          customer-provided, support-verified technical evidence, or clearly
          labelled as AI inference.
        </p>
      </Card>

      <ol className="space-y-4">
        {SECTIONS.map((section, index) => (
          <li key={section.title}>
            <Card padding="lg">
              <p className="font-mono text-xs font-semibold text-muted">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h2 className="mt-1 text-base font-semibold text-foreground">
                {section.title}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">
                {section.body}
              </p>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
