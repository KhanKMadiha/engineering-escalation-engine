/**
 * Short technical preview for compact evidence cards.
 * Does not mutate or truncate stored evidence — presentation only.
 */
export function evidenceBodyPreview(
  body: string | null | undefined,
  maxChars = 140,
): string | null {
  if (!body) {
    return null;
  }
  const normalised = body.replace(/\r\n/g, "\n").trim();
  if (!normalised) {
    return null;
  }
  const firstLines = normalised
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(0, 3)
    .join("\n");
  if (firstLines.length <= maxChars) {
    return firstLines;
  }
  return `${firstLines.slice(0, maxChars - 1).trimEnd()}…`;
}
