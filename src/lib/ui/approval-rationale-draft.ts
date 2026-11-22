/**
 * In-memory, case-scoped draft for Escalation approval rationale.
 * Survives tab remounts within the same browser session without persisting
 * an unapproved decision. Cleared after successful approval / rejection.
 *
 * Empty string and whitespace-only values are stored as drafts so clearing the
 * field does not restore the suggested text on remount. `undefined` means no
 * draft has been stored yet.
 */

const drafts = new Map<string, string>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeApprovalRationaleDrafts(
  listener: () => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getApprovalRationaleDraftVersion(): number {
  return version;
}

/**
 * Returns the exact stored draft (including "" / whitespace), or `undefined`
 * when no draft exists for this case.
 */
export function getApprovalRationaleDraft(caseId: string): string | undefined {
  const key = caseId.trim();
  if (!key) {
    return undefined;
  }
  if (!drafts.has(key)) {
    return undefined;
  }
  return drafts.get(key);
}

/**
 * Store an in-progress edit exactly as typed, including "" and whitespace.
 * Does not delete on empty — only `clearApprovalRationaleDraft` removes a draft.
 */
export function setApprovalRationaleDraft(caseId: string, value: string): void {
  const key = caseId.trim();
  if (!key) {
    return;
  }
  if (drafts.has(key) && drafts.get(key) === value) {
    return;
  }
  drafts.set(key, value);
  emit();
}

export function clearApprovalRationaleDraft(caseId: string): void {
  const key = caseId.trim();
  if (!key) {
    return;
  }
  if (drafts.delete(key)) {
    emit();
  }
}

/** Test helper — do not call from product UI. */
export function resetApprovalRationaleDraftsForTests(): void {
  if (drafts.size === 0) {
    return;
  }
  drafts.clear();
  emit();
}
