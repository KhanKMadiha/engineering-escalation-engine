import { Disclosure } from "@/components/ui/Disclosure";
import {
  ESCALATION_THRESHOLDS,
  ESCALATION_WEIGHTS,
} from "@/lib/escalation/escalation-rules";

const STAGES = [
  {
    title: "Case details",
    body: "Capture the customer issue, impact and context as reported. The product does not invent technical evidence.",
  },
  {
    title: "Investigation",
    body: "Document reproduction steps, expected versus actual behaviour, and evidence already collected on the case.",
  },
  {
    title: "Assessment",
    body: "AI analysis is advisory. A fixed scoring model produces a readiness score and recommendation from case signals.",
  },
  {
    title: "Escalation approval",
    body: "A reviewer must approve escalation or continue investigation. AI recommendations never escalate a case on their own.",
  },
  {
    title: "Create escalation",
    body: "After approval, generate a structured Engineering handoff. Jira and Rootly records in this demo are simulated.",
  },
] as const;

const PRINCIPLES = [
  {
    title: "Evidence first",
    body: "Use customer-provided or verified technical evidence. AI inference is labelled separately.",
  },
  {
    title: "Human judgement",
    body: "Combine AI analysis with human review. Escalation to Engineering requires explicit approval.",
  },
  {
    title: "Clear handoffs",
    body: "Produce consistent, actionable handoffs so Engineering receives what Support already knows.",
  },
] as const;

/**
 * Explanatory resource page. Describes confirmed product behaviour only.
 */
export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          How it works
        </h1>
        <p className="max-w-3xl text-[15px] text-muted">
          From investigation to an evidence-based Engineering handoff.
        </p>
      </div>

      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="min-w-0">
            <p className="font-mono text-xs font-semibold text-accent">
              {String(index + 1).padStart(2, "0")}
            </p>
            <h2 className="mt-1.5 text-[15px] font-semibold text-foreground">
              {stage.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {stage.body}
            </p>
          </li>
        ))}
      </ol>

      <section className="border-t border-border pt-8" aria-labelledby="principles-heading">
        <h2
          id="principles-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Our principles
        </h2>
        <ul className="mt-5 grid gap-6 sm:grid-cols-3">
          {PRINCIPLES.map((principle) => (
            <li key={principle.title}>
              <h3 className="text-[15px] font-semibold text-foreground">
                {principle.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">
                {principle.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <Disclosure summary="How the readiness score works" className="bg-subtle">
        <div className="space-y-3 text-sm leading-relaxed text-muted">
          <p>
            The readiness score is calculated by fixed rules. AI can contribute
            labelled signals, but it cannot change the weights or thresholds.
          </p>
          <p>
            Score ranges from 0 to 100. Recommendations use these cut-offs:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {ESCALATION_THRESHOLDS.escalateMin}–100: Escalate
            </li>
            <li>
              {ESCALATION_THRESHOLDS.continueMin}–
              {ESCALATION_THRESHOLDS.escalateMin - 1}: Continue investigation
            </li>
            <li>
              0–{ESCALATION_THRESHOLDS.continueMin - 1}: Insufficient evidence
            </li>
          </ul>
          <p>Examples of scoring factors include:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Production environment (+{ESCALATION_WEIGHTS.productionEnvironment})
            </li>
            <li>
              Reported high severity (+{ESCALATION_WEIGHTS.reportedSeverityHigh})
            </li>
            <li>
              Suspected product defect (+{ESCALATION_WEIGHTS.suspectedProductDefect})
            </li>
            <li>
              Confirmed reproducibility (+
              {ESCALATION_WEIGHTS.confirmedReproducibility})
            </li>
            <li>
              Missing logs and request IDs (
              {ESCALATION_WEIGHTS.missingLogsAndRequestIds})
            </li>
          </ul>
          <p>
            A human reviewer still decides whether to escalate. Simulated Jira
            and Rootly actions only run after approval.
          </p>
        </div>
      </Disclosure>
    </div>
  );
}
