export type ProvenanceSource =
  | "customer_provided"
  | "extracted_evidence"
  | "ai_inference"
  | "deterministic_engine"
  | "human_decision"
  | "engineering_handoff";

export type ProvenanceField<T> = {
  value: T;
  source: ProvenanceSource;
  note?: string;
};
