import { describe, expect, it } from "vitest";
import { defaultSources } from "../config/researchSources";
import { buildDeepSearchPlan, normalizeQuery } from "../services/deepSearch";
import { createCase, makeIdentifier, type ResearchCase, type SearchHistoryEntry } from "../types";

const plan = (
  c: ResearchCase,
  overrides: Partial<Parameters<typeof buildDeepSearchPlan>[2]> = {},
  sources = defaultSources,
  history: SearchHistoryEntry[] = [],
) =>
  buildDeepSearchPlan(
    c,
    sources,
    {
      maxTasks: 60,
      includePublicRecords: false,
      preferredEngines: ["google", "bing", "duckduckgo"],
      ...overrides,
    },
    history,
  );

describe("Deep Search planning", () => {
  it("builds an exact name and source-specific discovery without malformed values", () => {
    const tasks = plan(createCase("John Michael Smith"));
    expect(tasks.some((task) => task.query === '"John Michael Smith"')).toBe(true);
    expect(tasks.some((task) => task.query.startsWith("site:") && task.query.includes('"John Michael Smith"'))).toBe(true);
    expect(tasks.every((task) => !/undefined|null/.test(task.query))).toBe(true);
  });

  it("prioritizes name plus city", () => {
    const c = createCase("John Smith");
    const city = makeIdentifier("city", "Austin");
    c.identifiers.push(city);
    const task = plan(c).find((item) => item.query === '"John Smith" "Austin"');
    expect(task?.searchPriority).toBe("strong");
    expect(task?.priority).toBeLessThan(20);
  });

  it("generates name plus employer", () => {
    const c = createCase("John Smith");
    c.identifiers.push(makeIdentifier("employer", "Acme Corp"));
    expect(plan(c).some((task) => task.query === '"John Smith" "Acme Corp"')).toBe(true);
  });

  it("pivots a username across social sources", () => {
    const c = createCase("John Smith");
    c.identifiers.push(makeIdentifier("username", "@johnsmith92"));
    const tasks = plan(c);
    for (const source of ["instagram", "x", "tiktok", "reddit", "youtube"])
      expect(tasks.some((task) => task.targetSourceId === source && task.query.includes("johnsmith92"))).toBe(true);
  });

  it("generates an exact email search", () => {
    const c = createCase("John Smith");
    c.identifiers.push(makeIdentifier("email", "john@example.com"));
    expect(plan(c).some((task) => task.query === '"john@example.com"')).toBe(true);
  });

  it("deduplicates duplicate identifiers and normalized queries", () => {
    const c = createCase("John Smith");
    c.identifiers.push(makeIdentifier("city", "Austin"), makeIdentifier("city", "  Austin  "));
    const tasks = plan(c);
    const keys = tasks.map((task) => `${task.normalizedQuery}|${task.engineSourceId}|${task.targetSourceId || ""}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(normalizeQuery('  "JOHN Smith"   "Austin" ')).toBe('"john smith" "austin"');
  });

  it("does not repeat completed searches", () => {
    const c = createCase("John Smith");
    const first = plan(c);
    const history: SearchHistoryEntry[] = first.map((task) => ({
      id: crypto.randomUUID(),
      searchRunId: crypto.randomUUID(),
      taskId: task.id,
      query: task.query,
      normalizedQuery: task.normalizedQuery,
      engineSourceId: task.engineSourceId,
      targetSourceId: task.targetSourceId,
      identifierIds: task.identifierIds,
      url: task.url,
      timestamp: new Date().toISOString(),
      status: "reviewed",
    }));
    expect(plan(c, {}, defaultSources, history)).toHaveLength(0);
  });

  it("excludes public records by default and includes them only when enabled", () => {
    const c = createCase("John Smith");
    expect(plan(c).some((task) => task.category === "ARREST")).toBe(false);
    expect(plan(c).some((task) => task.targetSourceId === "mugshots-com")).toBe(false);
    const publicTasks = plan(c, { includePublicRecords: true, maxTasks: 36 }).filter((task) => task.category === "ARREST");
    expect(publicTasks.length).toBeGreaterThan(0);
    expect(publicTasks.every((task) => task.requiresIndependentVerification)).toBe(true);
    expect(plan(c, { includePublicRecords: true, maxTasks: 36 }).some((task) => task.targetSourceId === "mugshots-com")).toBe(true);
  });

  it("respects disabled sources", () => {
    const c = createCase("John Smith");
    const sources = defaultSources.map((source) => source.id === "facebook" ? { ...source, enabled: false } : source);
    expect(plan(c, {}, sources).some((task) => task.targetSourceId === "facebook")).toBe(false);
  });

  it("respects the configured task limit", () => {
    const c = createCase("John Smith");
    c.identifiers.push(makeIdentifier("username", "johnsmith92"), makeIdentifier("city", "Austin"));
    expect(plan(c, { maxTasks: 12 })).toHaveLength(12);
  });

  it("builds continuation searches only from the new approved seed", () => {
    const c = createCase("John Smith");
    const city = makeIdentifier("city", "Austin");
    const username = makeIdentifier("username", "johnsmith92");
    c.identifiers.push(city, username);
    const tasks = plan(c, { maxTasks: 18, seedIdentifierIds: [username.id] });
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((task) => task.identifierIds.includes(username.id))).toBe(true);
    expect(tasks.some((task) => task.targetSourceId === "instagram")).toBe(true);
  });

  it("never expands an unverified lead until the analyst approves it", () => {
    const c = createCase("John Smith");
    const username = makeIdentifier("username", "unconfirmed-handle");
    username.status = "unverified_lead";
    c.identifiers.push(username);
    expect(plan(c).some((task) => task.query.includes("unconfirmed-handle"))).toBe(false);
  });
});
