import Link from "next/link";
import { AppContainer } from "@/components/layout/AppContainer";

export function AppHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <AppContainer className="flex h-14 items-center">
        <Link
          href="/"
          className="text-lg font-semibold leading-snug tracking-tight text-slate-900 hover:text-slate-700"
        >
          Engineering Escalation Engine
        </Link>
      </AppContainer>
    </header>
  );
}
