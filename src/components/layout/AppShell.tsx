"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BookOpen,
  CirclePlus,
  ClipboardCheck,
  Inbox,
  Send,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { ProductBrand } from "@/components/layout/ProductBrand";
import { AppIcon, ICON_SIZE_NAV } from "@/components/ui/AppIcon";
import { formatCaseKey } from "@/lib/ui/case-display";

type NavItem = {
  href: string;
  label: string;
  match: "exact" | "prefix";
  icon: LucideIcon;
  badge?: number;
};

type NavSection = {
  title: string;
  items: readonly NavItem[];
};

type AppShellProps = {
  children: ReactNode;
  pendingReviewsCount?: number;
  handoffsCount?: number;
};

function buildNavSections(
  pendingReviewsCount: number,
  handoffsCount: number,
): readonly NavSection[] {
  return [
    {
      title: "Workspace",
      items: [
        { href: "/", label: "Case queue", match: "exact", icon: Inbox },
        {
          href: "/cases/new",
          label: "New case",
          match: "exact",
          icon: CirclePlus,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          href: "/pending-reviews",
          label: "Pending reviews",
          match: "exact",
          icon: ClipboardCheck,
          badge: pendingReviewsCount,
        },
        {
          href: "/handoffs",
          label: "Handoffs",
          match: "exact",
          icon: Send,
          badge: handoffsCount,
        },
        { href: "/activity", label: "Activity", match: "exact", icon: Activity },
      ],
    },
    {
      title: "Resources",
      items: [
        {
          href: "/how-it-works",
          label: "How it works",
          match: "exact",
          icon: BookOpen,
        },
      ],
    },
  ];
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") {
    return pathname === "/";
  }
  if (item.match === "exact") {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function breadcrumbLabel(pathname: string): string {
  if (pathname.startsWith("/cases/new")) return "New case";
  if (pathname === "/pending-reviews") return "Pending reviews";
  if (pathname === "/handoffs") return "Handoffs";
  if (pathname === "/activity") return "Activity";
  if (pathname === "/how-it-works") return "How it works";
  if (pathname.startsWith("/cases/")) {
    const caseId = pathname.split("/")[2];
    if (caseId) return formatCaseKey(caseId);
  }
  return "Case queue";
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
}) {
  const showBadge = typeof item.badge === "number" && item.badge > 0;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-[15px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
        active
          ? "border-l-2 border-sidebar-accent bg-sidebar-active pl-[10px] text-sidebar-active-foreground"
          : "border-l-2 border-transparent text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <AppIcon
          icon={item.icon}
          size={ICON_SIZE_NAV}
          className={
            active ? "text-sidebar-active-foreground" : "text-sidebar-muted"
          }
        />
        <span className="truncate">{item.label}</span>
      </span>
      {showBadge ? (
        <span
          className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-sidebar-accent/30 px-1.5 py-0.5 text-[11px] font-semibold text-sidebar-active-foreground tabular-nums"
          aria-label={`${item.badge} items`}
        >
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

function SidebarNav({
  pathname,
  sections,
  onNavigate,
}: {
  pathname: string;
  sections: readonly NavSection[];
  onNavigate?: () => void;
}) {
  return (
    <nav
      className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5"
      aria-label="Primary"
    >
      {sections.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted">
            {section.title}
          </p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * Application chrome: charcoal sidebar + pure-white workspace canvas.
 * Sidebar counts come from real case statuses only.
 */
export function AppShell({
  children,
  pendingReviewsCount = 0,
  handoffsCount = 0,
}: AppShellProps) {
  const pathname = usePathname() ?? "/";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const sections = buildNavSections(pendingReviewsCount, handoffsCount);

  return (
    <div className="flex min-h-full bg-background">
      <aside className="sticky top-0 z-20 hidden h-screen w-[17rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex min-h-14 shrink-0 items-center border-b border-sidebar-border px-4 py-3">
          <ProductBrand />
        </div>
        <SidebarNav pathname={pathname} sections={sections} />
      </aside>

      {mobileNavOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <button
            type="button"
            className="absolute inset-0 bg-[#1c1f24]/50"
            aria-label="Close navigation"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="relative flex h-full w-[min(17rem,88vw)] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-sidebar-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <ProductBrand compact />
              </div>
              <button
                type="button"
                className="min-h-10 shrink-0 rounded-md px-2.5 py-1.5 text-sm text-sidebar-muted outline-none hover:bg-sidebar-hover hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-accent"
                onClick={() => setMobileNavOpen(false)}
              >
                Close
              </button>
            </div>
            <SidebarNav
              pathname={pathname}
              sections={sections}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-surface">
          <div
            className="flex h-12 items-center justify-between gap-3 sm:h-14"
            style={{
              paddingLeft: "var(--content-pad-x)",
              paddingRight: "var(--content-pad-x)",
            }}
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                className="inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground outline-none hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 lg:hidden"
                aria-expanded={mobileNavOpen}
                onClick={() => setMobileNavOpen(true)}
              >
                Menu
              </button>
              <nav aria-label="Breadcrumb" className="min-w-0">
                <ol className="flex items-center gap-1.5 text-sm">
                  <li className="font-medium text-foreground">Cases</li>
                  <li className="text-border" aria-hidden>
                    /
                  </li>
                  <li className="truncate text-muted">
                    {breadcrumbLabel(pathname)}
                  </li>
                </ol>
              </nav>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <p
                className="flex items-center gap-2 text-sm text-muted"
                title="Fictional cases. No real customer data."
              >
                <span className="inline-flex rounded-md border border-border bg-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  Demo
                </span>
                <span className="hidden sm:inline">
                  Fictional cases. No real customer data.
                </span>
                <span className="sr-only sm:hidden">
                  Fictional cases. No real customer data.
                </span>
              </p>
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent ring-1 ring-[#b8ddd4]"
                aria-hidden
              >
                MK
              </span>
            </div>
          </div>
        </header>
        <main
          className="flex-1"
          style={{
            paddingLeft: "var(--content-pad-x)",
            paddingRight: "var(--content-pad-x)",
            paddingTop: "var(--content-pad-y)",
            paddingBottom: "var(--content-pad-y)",
          }}
        >
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
