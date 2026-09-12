function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Compact Support Ops datetime: "10 Sep 2026, 19:09"
 * Presentation only — does not alter underlying timestamps.
 */
function formatDateTime(value: string | null | undefined): string {
  const parts = formatDateTimeParts(value);
  if (!parts) {
    return value && Number.isNaN(new Date(value).getTime()) ? value : "—";
  }
  return `${parts.date}, ${parts.time}`;
}

/**
 * Split date/time for compact table cells (stacked lines).
 * Presentation only — does not alter underlying timestamps.
 */
function formatDateTimeParts(
  value: string | null | undefined,
): { date: string; time: string } | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const day = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return {
    date: `${day} ${month} ${year}`,
    time: `${hours}:${minutes}`,
  };
}

/**
 * Display "Issue first observed": prefer approximate customer/support text;
 * fall back to a precise incidentTimestamp only when that ISO value exists.
 * Does not invent or parse timestamps from approximate phrases.
 */
function formatIssueFirstObserved(input: {
  issueFirstObserved: string | null | undefined;
  incidentTimestamp: string | null | undefined;
}): string {
  const approx = input.issueFirstObserved?.trim();
  if (approx) {
    return approx;
  }
  return formatDateTime(input.incidentTimestamp);
}

export { formatDateTime, formatDateTimeParts, formatIssueFirstObserved };
