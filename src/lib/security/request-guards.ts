/**
 * Process-local request guards for analysis and decision actions.
 *
 * Limitations: this is single-process / in-memory only. It does not provide
 * distributed locking across multiple application instances.
 */

const analysisLocks = new Set<string>();
const decisionLocks = new Set<string>();

export class AnalysisInProgressError extends Error {
  constructor(caseId: string) {
    super(`Analysis is already in progress for case ${caseId}`);
    this.name = "AnalysisInProgressError";
  }
}

export class DecisionInProgressError extends Error {
  constructor(caseId: string) {
    super(`A decision is already being recorded for case ${caseId}`);
    this.name = "DecisionInProgressError";
  }
}

export function tryAcquireAnalysisLock(caseId: string): boolean {
  if (analysisLocks.has(caseId)) {
    return false;
  }
  analysisLocks.add(caseId);
  return true;
}

export function releaseAnalysisLock(caseId: string): void {
  analysisLocks.delete(caseId);
}

export function tryAcquireDecisionLock(caseId: string): boolean {
  if (decisionLocks.has(caseId)) {
    return false;
  }
  decisionLocks.add(caseId);
  return true;
}

export function releaseDecisionLock(caseId: string): void {
  decisionLocks.delete(caseId);
}

/** Test helper — clear all process-local locks. */
export function resetRequestGuards(): void {
  analysisLocks.clear();
  decisionLocks.clear();
}

export function isAnalysisLocked(caseId: string): boolean {
  return analysisLocks.has(caseId);
}

export function isDecisionLocked(caseId: string): boolean {
  return decisionLocks.has(caseId);
}
