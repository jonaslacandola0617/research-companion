import { describe, it, expect } from "vitest";
import { createCase, makeIdentifier, caseSchema } from "../types";
import {
  buildQueries,
  buildSearchUrl,
  detectIdentifierType,
  validateTemplate,
} from "../services/queryBuilder";
import { defaultSources } from "../config/researchSources";
import { importCase, serializeCase } from "../services/exportImport";
import { applyMutation, emptyState, migrate } from "../services/storage";
describe("query generation", () => {
  it("uses available identifiers and quotes embedded names safely", () => {
    const c = createCase('John "Michael" Smith');
    c.profile.city = "Orlando";
    expect(buildQueries(c)).toContain('"John Michael Smith" "Orlando"');
    expect(buildQueries(c).some((q) => q.includes("undefined"))).toBe(false);
  });
});
describe("identifier suggestion", () => {
  it.each([
    ["person@example.com", "email"],
    ["@sample", "username"],
    ["https://example.org", "website"],
    ["+1 (407) 555-1234", "phone"],
    ["Orlando, FL", "address"],
    ["John Smith", undefined],
  ])("suggests %s", (value, type) =>
    expect(detectIdentifierType(value)).toBe(type),
  );
});
describe("source URLs", () => {
  it("encodes search input without query injection", () => {
    const url = buildSearchUrl(
      defaultSources.find((s) => s.id === "google")!,
      makeIdentifier("name", "A & B#/?@+"),
      createCase("Test"),
    );
    expect(new URL(url).searchParams.get("q")).toBe("A & B#/?@+");
    expect([...new URL(url).searchParams.keys()]).toEqual(["q"]);
  });
  it("falls back to homepage", () => {
    const s = defaultSources.find((s) => s.id === "whitepages")!;
    expect(
      buildSearchUrl(s, makeIdentifier("name", "Test"), createCase("Test")),
    ).toBe(s.homepage);
  });
  it("rejects unsupported types and unsafe templates", () => {
    expect(() =>
      buildSearchUrl(
        defaultSources.find((s) => s.id === "whatsmyname")!,
        makeIdentifier("email", "a@b.com"),
        createCase("Test"),
      ),
    ).toThrow("does not support");
    for (const t of [
      "javascript:alert(1)",
      "https://{name}.com",
      "https://example.com/?q={password}",
      "https://user:pass@example.com",
    ])
      expect(() => validateTemplate(t)).toThrow();
  });
  it("requires missing template variables", () => {
    const source = {
      ...defaultSources[0],
      strategy: "template" as const,
      template: "https://example.com/?q={email}",
    };
    expect(() =>
      buildSearchUrl(
        source,
        makeIdentifier("name", "Test"),
        createCase("Test"),
      ),
    ).toThrow("email");
  });
});
describe("case serialization and validation", () => {
  it("roundtrips IDs and Unicode", () => {
    const c = createCase("Fictional José");
    c.notes = "<script>alert(1)</script>";
    expect(importCase(serializeCase(c))).toEqual(c);
  });
  it("rejects malformed, unknown versions and oversized input", () => {
    for (const s of [
      "{}",
      "null",
      '{"schemaVersion":2}',
      "not json",
      "x".repeat(10_000_001),
    ])
      expect(() => importCase(s)).toThrow();
  });
  it("preserves bad storage rather than overwriting it", () =>
    expect(() => migrate({ schemaVersion: 99 })).toThrow("preserved"));
  it("blocks conflicting saves and duplicate imports", () => {
    const c = createCase("A");
    const state = emptyState();
    state.cases = [c];
    expect(() =>
      applyMutation(state, { type: "save", data: c, expected: "old" }),
    ).toThrow("another panel");
    expect(() => applyMutation(state, { type: "import", data: c })).toThrow(
      "already exists",
    );
  });
  it("rejects unsafe finding provenance", () => {
    const c = createCase("A");
    expect(
      caseSchema.safeParse({
        ...c,
        findings: [{ sourceUrl: "javascript:alert(1)" }],
      }).success,
    ).toBe(false);
  });
});
