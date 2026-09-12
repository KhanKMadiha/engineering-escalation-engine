/**
 * Persistence-layer errors shared by repository implementations.
 * Domain services may map these to domain errors.
 * Do not expose raw database error text to end users.
 */

export class PersistenceError extends Error {
  readonly code: string;

  constructor(
    message: string,
    code = "PERSISTENCE_ERROR",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PersistenceError";
    this.code = code;
  }
}

export class RecordNotFoundError extends PersistenceError {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`, "NOT_FOUND");
    this.name = "RecordNotFoundError";
  }
}

export class DuplicateDecisionError extends PersistenceError {
  constructor(caseId: string) {
    super(
      `Human decision already exists for case ${caseId}`,
      "DUPLICATE_DECISION",
    );
    this.name = "DuplicateDecisionError";
  }
}

export class ForeignKeyViolationError extends PersistenceError {
  constructor(message = "Referenced record does not exist") {
    super(message, "FOREIGN_KEY_VIOLATION");
    this.name = "ForeignKeyViolationError";
  }
}

export class ConstraintViolationError extends PersistenceError {
  constructor(message: string, code = "CONSTRAINT_VIOLATION") {
    super(message, code);
    this.name = "ConstraintViolationError";
  }
}

type DatabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function mapDatabaseError(
  error: DatabaseLikeError,
  context: string,
): PersistenceError {
  const code = error.code ?? "";
  const message = error.message ?? "Unknown database error";

  if (code === "23505") {
    if (
      message.includes("human_decisions") ||
      message.includes("human_decisions_case_id")
    ) {
      const match = /case[= ]([0-9a-f-]{36})/i.exec(context);
      return new DuplicateDecisionError(match?.[1] ?? "unknown");
    }
    return new ConstraintViolationError(
      `Duplicate record (${context})`,
      "UNIQUE_VIOLATION",
    );
  }

  if (code === "23503") {
    return new ForeignKeyViolationError(`Invalid reference (${context})`);
  }

  if (code === "23514" || code === "23502" || code === "22P02") {
    return new ConstraintViolationError(`Invalid data (${context})`, code);
  }

  if (message.includes("CASE_NOT_AWAITING_DECISION")) {
    return new ConstraintViolationError(
      "Case is not awaiting a human decision",
      "CASE_NOT_AWAITING_DECISION",
    );
  }

  return new PersistenceError(
    `Database operation failed (${context})`,
    code || "DATABASE_ERROR",
  );
}
