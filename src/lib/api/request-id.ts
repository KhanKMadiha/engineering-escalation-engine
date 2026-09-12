/**
 * Operational correlation IDs for API requests.
 * These are NOT customer evidence / support-case request IDs.
 */

export const REQUEST_ID_HEADER = "x-request-id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function resolveRequestId(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)?.trim();
  if (incoming && incoming.length <= 128 && UUID_RE.test(incoming)) {
    return incoming;
  }
  return crypto.randomUUID();
}
