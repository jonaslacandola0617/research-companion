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
  it("migrates version 1 cases without deleting existing records", () => {
    const current = emptyState();
    const c = createCase("Legacy Person");
    c.identifiers.push(makeIdentifier("username", "legacy-handle"));
    const legacyCase = structuredClone(c) as Record<string, any>;
    legacyCase.identifiers[0].status = "unverified";
    delete legacyCase.searchRuns;
    delete legacyCase.searchHistory;
    delete legacyCase.leads;
    const legacySources = current.settings.sources.map((source) => {
      const value = structuredClone(source) as Record<string, any>;
      delete value.interaction;
      delete value.directTemplate;
      delete value.priority;
      delete value.requiresLogin;
      delete value.potentiallyBlocked;
      return value;
    });
    const migrated = migrate({
      schemaVersion: 1,
      activeCaseId: c.id,
      cases: [legacyCase],
      settings: { theme: "light", sources: legacySources },
    });
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.cases[0].subjectName).toBe("Legacy Person");
    expect(migrated.cases[0].identifiers[0].status).toBe("analyst_supplied");
    expect(migrated.cases[0].searchRuns).toEqual([]);
    expect(migrated.settings.deepSearch.defaultTaskLimit).toBe(36);
  });
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
