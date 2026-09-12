"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import {
  createCase,
  type CreateCaseActionState,
} from "@/actions/case-actions";
import {
  ENVIRONMENT_VALUES,
  SEVERITY_VALUES,
} from "@/lib/cases/case-validators";

const initialState: CreateCaseActionState = { ok: true };

function fieldError(
  state: CreateCaseActionState,
  field: string,
): string | undefined {
  return state.fieldErrors?.[field as keyof NonNullable<typeof state.fieldErrors>]?.[0];
}

function FieldLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-slate-800"
    >
      {children}
      {required ? <span className="ml-0.5 text-red-600">*</span> : null}
    </label>
  );
}

function FieldHint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs text-slate-500">{children}</p>;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <p className="mt-1 text-xs text-red-700" role="alert">
      {message}
    </p>
  );
}

const inputClass =
  "mt-1 block w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-none outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500";
const textareaClass = `${inputClass} min-h-24 font-mono text-[13px] leading-relaxed`;

export function CaseForm() {
  const [state, formAction, pending] = useActionState(createCase, initialState);

  const value = (name: string, fallback = "") =>
    state.values?.[name] ?? fallback;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.formError ? (
        <div
          className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {state.formError}
        </div>
      ) : null}

      <section className="space-y-4 rounded border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Customer and impact
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Who reported the issue and what is affected.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="customer" required>
              Customer
            </FieldLabel>
            <input
              id="customer"
              name="customer"
              type="text"
              required
              defaultValue={value("customer")}
              className={inputClass}
              autoComplete="organization"
            />
            <FieldError message={fieldError(state, "customer")} />
          </div>
          <div>
            <FieldLabel htmlFor="product" required>
              Product
            </FieldLabel>
            <input
              id="product"
              name="product"
              type="text"
              required
              defaultValue={value("product")}
              className={inputClass}
            />
            <FieldError message={fieldError(state, "product")} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="severity" required>
              Severity
            </FieldLabel>
            <select
              id="severity"
              name="severity"
              required
              defaultValue={value("severity", "")}
              className={inputClass}
            >
              <option value="" disabled>
                Select severity
              </option>
              {SEVERITY_VALUES.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
            <FieldError message={fieldError(state, "severity")} />
          </div>
          <div>
            <FieldLabel htmlFor="environment" required>
              Environment
            </FieldLabel>
            <select
              id="environment"
              name="environment"
              required
              defaultValue={value("environment", "")}
              className={inputClass}
            >
              <option value="" disabled>
                Select environment
              </option>
              {ENVIRONMENT_VALUES.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
            <FieldError message={fieldError(state, "environment")} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="affectedCustomerCount">
              Affected customer count
            </FieldLabel>
            <input
              id="affectedCustomerCount"
              name="affectedCustomerCount"
              type="number"
              min={1}
              max={1_000_000}
              step={1}
              defaultValue={value("affectedCustomerCount")}
              className={inputClass}
            />
            <FieldHint>Optional. Whole number of affected customers.</FieldHint>
            <FieldError message={fieldError(state, "affectedCustomerCount")} />
          </div>
          <div>
            <FieldLabel htmlFor="issueFirstObserved">
              Issue first observed{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </FieldLabel>
            <input
              id="issueFirstObserved"
              name="issueFirstObserved"
              type="text"
              defaultValue={value("issueFirstObserved")}
              placeholder="e.g. This morning, Yesterday, Around 10 September"
              className={inputClass}
              maxLength={500}
            />
            <FieldHint>
              Approximate timeframe is fine. Leave blank if unknown.
            </FieldHint>
            <FieldError message={fieldError(state, "issueFirstObserved")} />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Issue details</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            What happened and how it differs from expected behaviour.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="issueTitle" required>
            Issue title
          </FieldLabel>
          <input
            id="issueTitle"
            name="issueTitle"
            type="text"
            required
            defaultValue={value("issueTitle")}
            className={inputClass}
          />
          <FieldError message={fieldError(state, "issueTitle")} />
        </div>
        <div>
          <FieldLabel htmlFor="issueDescription" required>
            Issue description
          </FieldLabel>
          <textarea
            id="issueDescription"
            name="issueDescription"
            required
            rows={4}
            defaultValue={value("issueDescription")}
            className={textareaClass}
          />
          <FieldError message={fieldError(state, "issueDescription")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="expectedBehaviour">
              Expected behaviour
            </FieldLabel>
            <textarea
              id="expectedBehaviour"
              name="expectedBehaviour"
              rows={4}
              defaultValue={value("expectedBehaviour")}
              placeholder="What should have happened."
              className={textareaClass}
            />
            <FieldHint>Optional. Customer/support-provided.</FieldHint>
            <FieldError message={fieldError(state, "expectedBehaviour")} />
          </div>
          <div>
            <FieldLabel htmlFor="actualBehaviour">Actual behaviour</FieldLabel>
            <textarea
              id="actualBehaviour"
              name="actualBehaviour"
              rows={4}
              defaultValue={value("actualBehaviour")}
              placeholder="What actually happened."
              className={textareaClass}
            />
            <FieldHint>Optional. Customer/support-provided.</FieldHint>
            <FieldError message={fieldError(state, "actualBehaviour")} />
          </div>
        </div>
        <div>
          <FieldLabel htmlFor="stepsToReproduce">
            Steps to reproduce
          </FieldLabel>
          <textarea
            id="stepsToReproduce"
            name="stepsToReproduce"
            rows={5}
            defaultValue={value("stepsToReproduce")}
            placeholder={
              "1. Navigate to...\n2. Configure...\n3. Send the request...\n4. Observe the response..."
            }
            className={textareaClass}
          />
          <FieldHint>
            Optional. Numbered customer/support-provided steps. Documenting
            steps does not by itself confirm the issue is reproducible.
          </FieldHint>
          <FieldError message={fieldError(state, "stepsToReproduce")} />
        </div>
      </section>

      <section className="space-y-4 rounded border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Investigation and evidence
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Capture troubleshooting performed and the technical evidence
            available.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Do not invent request IDs or logs.
          </p>
        </div>
        <div>
          <FieldLabel htmlFor="troubleshootingPerformed" required>
            Troubleshooting performed
          </FieldLabel>
          <textarea
            id="troubleshootingPerformed"
            name="troubleshootingPerformed"
            required
            rows={4}
            defaultValue={value("troubleshootingPerformed")}
            className={textareaClass}
          />
          <FieldError message={fieldError(state, "troubleshootingPerformed")} />
        </div>
        <div>
          <FieldLabel htmlFor="logsErrors" required>
            Logs / errors
          </FieldLabel>
          <textarea
            id="logsErrors"
            name="logsErrors"
            required
            rows={5}
            defaultValue={value("logsErrors")}
            className={textareaClass}
          />
          <FieldHint>Paste relevant log lines or error messages.</FieldHint>
          <FieldError message={fieldError(state, "logsErrors")} />
        </div>
        <div>
          <FieldLabel htmlFor="requestIds" required>
            Request / correlation IDs
          </FieldLabel>
          <textarea
            id="requestIds"
            name="requestIds"
            required
            rows={3}
            defaultValue={value("requestIds")}
            className={textareaClass}
          />
          <FieldHint>
            One or more request or correlation IDs, separated by commas or new
            lines.
          </FieldHint>
          <FieldError message={fieldError(state, "requestIds")} />
        </div>
      </section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Creating case…" : "Create case"}
        </button>
      </div>
    </form>
  );
}
