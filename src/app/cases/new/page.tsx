import Link from "next/link";
import { CaseForm } from "@/components/cases/CaseForm";
import { PageSection } from "@/components/layout/PageSection";

export default function NewCasePage() {
  return (
    <PageSection
      title="New support case"
      description="Capture customer-provided issue details and technical evidence. Analysis and escalation recommendation are added in later steps."
      actions={
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Back to dashboard
        </Link>
      }
    >
      <CaseForm />
    </PageSection>
  );
}
