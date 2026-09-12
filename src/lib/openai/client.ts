import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import {
  caseAnalysisResultSchema,
  type CaseAnalysisResult,
} from "@/lib/analysis/analysis-schema";
import type { AnalysisModelClient } from "@/lib/analysis/analyze-case";

export function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return apiKey;
}

export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o";
}

/** Server-only OpenAI SDK client. Never import from client components. */
export function createOpenAIClient(): OpenAI {
  return new OpenAI({ apiKey: getOpenAIApiKey() });
}

/**
 * Production AnalysisModelClient using the OpenAI Responses API
 * with structured outputs (zodTextFormat).
 *
 * OpenAI client construction is deferred until generateAnalysis runs so
 * read-only composition (list/get cases) can wire services without requiring
 * OPENAI_API_KEY.
 */
export function createOpenAIAnalysisModelClient(
  client?: OpenAI,
  model: string = getOpenAIModel(),
): AnalysisModelClient {
  let resolvedClient = client;
  return {
    model,
    async generateAnalysis({ systemPrompt, userPrompt }) {
      const openai = resolvedClient ?? (resolvedClient = createOpenAIClient());
      const response = await openai.responses.parse({
        model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        text: {
          format: zodTextFormat(caseAnalysisResultSchema, "case_analysis"),
        },
      });

      const parsed = response.output_parsed as CaseAnalysisResult | null;
      if (!parsed) {
        throw new Error("OpenAI returned no structured analysis output");
      }
      return parsed;
    },
  };
}
