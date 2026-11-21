import { formatCaseKey } from "@/lib/ui/case-display";
import { stripDemoMarkerPrefix } from "@/lib/demo/demo-cases";
import type { SupportCaseSummary } from "@/types";

export type ReportedDateRange = "all" | "30" | "60" | "90";

/**
 * Normalise text for case-insensitive partial search.
 * Hyphens/punctuation become spaces so "auto answer" matches "Auto-Answer".
 */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Token match: every query token must appear in the haystack.
 */
export function matchesSearchTokens(haystack: string, query: string): boolean {
  const normalisedQuery = normalizeSearchText(query);
  if (!normalisedQuery) return true;
  const hay = normalizeSearchText(haystack);
  return normalisedQuery.split(" ").every((token) => hay.includes(token));
}

/**
 * Search across internal case id (full + short key), issue title, and customer.
 */
export function caseMatchesSearch(
  item: SupportCaseSummary,
  query: string,
): boolean {
  const q = query.trim();
  if (!q) return true;

  const customer = stripDemoMarkerPrefix(item.customer);
  const issue = stripDemoMarkerPrefix(item.issueTitle);
  const shortKey = formatCaseKey(item.id);

  return (
    matchesSearchTokens(item.id, q) ||
    matchesSearchTokens(shortKey, q) ||
    matchesSearchTokens(issue, q) ||
    matchesSearchTokens(customer, q)
  );
}

/**
 * Filter by reported (createdAt) date relative to `now`.
 * Presentation-only; does not change stored timestamps.
 */
export function caseMatchesReportedRange(
  createdAt: string,
  range: ReportedDateRange,
  now: Date = new Date(),
): boolean {
  if (range === "all") return true;
  const days = Number(range);
  if (!Number.isFinite(days) || days <= 0) return true;

  const createdMs = Date.parse(createdAt);
  if (Number.isNaN(createdMs)) return false;

  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  return createdMs >= cutoffMs;
}
