import { describe, it, expect } from "vitest";
import { createDemoCase } from "../config/demo";
import { comparisonRows, setComparison } from "../services/comparison";
import { caseSchema, makeIdentifier } from "../types";
import { buildReport } from "../services/reportBuilder";
import { defaultSources } from "../config/researchSources";
import { importCase, serializeCase } from "../services/exportImport";
describe("candidate comparison data", () => {
  it("never derives a classification from cells", () => {
    const c = createDemoCase();
    const candidate = c.candidates[1];
    const updated = setComparison(
      candidate,
      c.identifiers[0].id,
      "Match",
      "Analyst checked",
    );
    expect(updated.classification).toBe("Insufficient Evidence");
    expect(candidate.comparisons[c.identifiers[0].id].status).toBe(
      "Partial Match",
    );
    expect(updated.comparisons[c.identifiers[0].id].note).toBe(
      "Analyst checked",
    );
  });
  it("uses Unknown for new identifiers", () => {
    const c = createDemoCase();
    c.identifiers.push(makeIdentifier("email", "fictional@example.com"));
    expect(
      comparisonRows(c)
        .at(-1)
        ?.cells.every((c) => c.status === "Unknown"),
    ).toBe(true);
  });
  it("rejects dangling references", () => {
    const c = createDemoCase();
    c.identifiers = [];
    expect(caseSchema.safeParse(c).success).toBe(false);
  });
  it("roundtrips the complete demo", () => {
    const c = createDemoCase();
    expect(importCase(serializeCase(c))).toEqual(c);
  });
});
describe("reports", () => {
  it("preserves evidence, provenance, conflicts, and human rationale", () => {
    const c = createDemoCase();
    const text = buildReport(c, defaultSources);
    for (const section of [
      "CASE INFORMATION",
      "KEY IDENTIFIERS",
      "LIKELY ASSOCIATED RECORDS",
      "POSSIBLE ASSOCIATIONS",
      "DISCREPANCIES",
      "UNRESOLVED ITEMS",
      "SOURCES REVIEWED",
      "ANALYST NOTES",
    ])
      expect(text).toContain(section);
    expect(text).toContain("FICTIONAL DEMO DATA");
    expect(text).toContain(c.findings[0].provenance.sourceUrl);
    expect(text).toContain(c.candidates[2].rationale);
    expect(text).not.toContain("Confirmed");
  });
});
