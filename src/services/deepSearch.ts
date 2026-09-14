import type {
  DeepSearchTask,
  Identifier,
  ResearchCase,
  ResearchSource,
  SearchHistoryEntry,
  SearchRun,
} from "../types";
import { now, uuid } from "../types";

export type SearchEngineId = "google" | "bing" | "duckduckgo";
export type DeepSearchOptions = {
  maxTasks: number;
  includePublicRecords: boolean;
  preferredEngines: SearchEngineId[];
  seedIdentifierIds?: string[];
  includePreviouslySearched?: boolean;
};

type Candidate = Omit<
  DeepSearchTask,
  "id" | "normalizedQuery" | "url" | "engineSourceId" | "status" | "enabled"
> & { preferredEngine?: SearchEngineId };

const engineUrls: Record<SearchEngineId, string> = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  duckduckgo: "https://duckduckgo.com/?q=",
};

const quote = (value: string) => `"${value.replace(/["“”]/g, "").trim()}"`;
const compact = (value: string) => value.replace(/\s+/g, " ").trim();
export const normalizeQuery = (query: string) =>
  compact(query)
    .replace(/[“”]/g, '"')
    .replace(/\s*:\s*/g, ":")
    .toLocaleLowerCase();

export const searchHistoryKey = (
  query: string,
  engine: SearchEngineId,
  targetSourceId?: string,
) => `${normalizeQuery(query)}|${engine}|${targetSourceId || "general"}`;

const stableId = (value: string) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `task-${(hash >>> 0).toString(36)}`;
};

function profileFallbacks(c: ResearchCase): Identifier[] {
  const make = (type: Identifier["type"], value: string, key: string): Identifier => ({
    id: `profile-${key}`,
    type,
    value,
    source: "Case profile",
    notes: "",
    createdAt: c.createdAt,
    confidence: "Unrated",
    status: "analyst_supplied",
  });
  const rows: Array<[Identifier["type"], string, string]> = [
    ["city", c.profile.city, "city"],
    ["state", c.profile.state, "state"],
    ["country", c.profile.country, "country"],
    ["employer", c.profile.employers.split(/\n|;/)[0] || "", "employer"],
    ["school", c.profile.schools.split(/\n|;/)[0] || "", "school"],
    ["username", c.profile.usernames.split(/\n|;/)[0] || "", "username"],
    ["email", c.profile.emails.split(/\n|;/)[0] || "", "email"],
    ["phone", c.profile.phones.split(/\n|;/)[0] || "", "phone"],
  ];
  return rows.filter(([, value]) => value.trim()).map(([type, value, key]) => make(type, value, key));
}

function approvedIdentifiers(c: ResearchCase) {
  const actual = c.identifiers.filter(
    (i) => ["analyst_supplied", "verified"].includes(i.status) && i.value.trim(),
  );
  const keys = new Set(actual.map((i) => `${i.type}|${compact(i.value).toLowerCase()}`));
  return [
    ...actual,
    ...profileFallbacks(c).filter(
      (i) => !keys.has(`${i.type}|${compact(i.value).toLowerCase()}`),
    ),
  ];
}

const strengthRank: Record<DeepSearchTask["searchPriority"], number> = {
  very_strong: 0,
  strong: 1,
  medium: 2,
  weak: 3,
};

export function buildDeepSearchPlan(
  c: ResearchCase,
  sources: ResearchSource[],
  options: DeepSearchOptions,
  history: SearchHistoryEntry[] = c.searchHistory,
): DeepSearchTask[] {
  const engines = options.preferredEngines.length
    ? options.preferredEngines
    : (["google"] as SearchEngineId[]);
  const approved = approvedIdentifiers(c);
  const selectedSeeds = options.seedIdentifierIds?.length
    ? approved.filter((i) => options.seedIdentifierIds!.includes(i.id))
    : approved;
  const seedIds = new Set(selectedSeeds.map((i) => i.id));
  const byType = (type: Identifier["type"]) => approved.filter((i) => i.type === type);
  const seeded = (type: Identifier["type"]) => selectedSeeds.filter((i) => i.type === type);
  const names = [
    ...byType("name"),
    ...byType("alias"),
    {
      id: "case-subject",
      type: "name" as const,
      value: c.subjectName,
      source: "Case subject",
      notes: "",
      createdAt: c.createdAt,
      confidence: "Unrated" as const,
      status: "analyst_supplied" as const,
    },
  ].filter(
    (item, index, all) =>
      item.value.trim() &&
      all.findIndex((x) => compact(x.value).toLowerCase() === compact(item.value).toLowerCase()) === index,
  );
  const primaryName = names[0];
  const locations = [...byType("city"), ...byType("state"), ...byType("country"), ...byType("previous_location")];
  const employers = byType("employer");
  const schools = byType("school");
  const candidates: Candidate[] = [];
  const add = (candidate: Candidate) => {
    if (!candidate.query.trim()) return;
    if (
      options.seedIdentifierIds?.length &&
      !candidate.identifierIds.some((id) => seedIds.has(id))
    )
      return;
    candidates.push(candidate);
  };
  const general = (
    query: string,
    reason: string,
    priority: number,
    searchPriority: Candidate["searchPriority"],
    ids: string[],
  ) =>
    add({
      query,
      reason,
      priority,
      searchPriority,
      identifierIds: ids,
      category: "GSR",
      interaction: "direct",
      requiresIndependentVerification: false,
    });

  for (const identifier of [...seeded("email"), ...seeded("phone"), ...seeded("username")]) {
    general(
      quote(identifier.value.replace(/^@/, "")),
      identifier.type === "username"
        ? "Exact username search"
        : `Exact ${identifier.type} search`,
      5,
      "very_strong",
      [identifier.id],
    );
  }
  if (!options.seedIdentifierIds?.length && primaryName)
    general(quote(primaryName.value), "Exact name search", 20, "medium", [primaryName.id]);
  for (const name of names.slice(0, 2)) {
    for (const location of locations.slice(0, 2))
      general(
        `${quote(name.value)} ${quote(location.value)}`,
        "Name + location",
        8,
        "strong",
        [name.id, location.id],
      );
    for (const employer of employers.slice(0, 2))
      general(
        `${quote(name.value)} ${quote(employer.value)}`,
        "Name + employer",
        9,
        "strong",
        [name.id, employer.id],
      );
    for (const school of schools.slice(0, 2))
      general(
        `${quote(name.value)} ${quote(school.value)}`,
        "Name + school",
        14,
        "strong",
        [name.id, school.id],
      );
  }
  if (primaryName && locations[0] && employers[0])
    general(
      `${quote(primaryName.value)} ${quote(locations[0].value)} ${quote(employers[0].value)}`,
      "Name + location + employer",
      7,
      "very_strong",
      [primaryName.id, locations[0].id, employers[0].id],
    );
  for (const username of byType("username")) {
    if (locations[0])
      general(
        `${quote(username.value.replace(/^@/, ""))} ${quote(locations[0].value)}`,
        "Username + location",
        13,
        "strong",
        [username.id, locations[0].id],
      );
    if (primaryName)
      general(
        `${quote(username.value.replace(/^@/, ""))} ${quote(primaryName.value)}`,
        "Username + name",
        16,
        "strong",
        [username.id, primaryName.id],
      );
  }

  const enabledTargets = sources
    .filter((source) => source.enabled && source.category !== "GSR")
    .filter(
      (source) =>
        options.includePublicRecords ||
        (source.category !== "ARREST" && !source.id.includes("mugshot")),
    )
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  for (const source of enabledTargets) {
    const sourceIds = selectedSeeds.filter((i) => source.supportedIdentifiers.includes(i.type));
    const username = sourceIds.find((i) => i.type === "username") || byType("username")[0];
    const email = sourceIds.find((i) => i.type === "email") || byType("email")[0];
    const phone = sourceIds.find((i) => i.type === "phone") || byType("phone")[0];
    const requiresVerification = source.category === "ARREST" || source.id.includes("mugshot");
    let signals: Identifier[] = [];
    let query = "";
    let reason = "Source-specific discovery";
    const usernameFirst =
      ["1ST SM", "TOP SOCMED", "SUB SOC"].includes(source.category) ||
      ["whatsmyname", "idcrawl"].includes(source.id);
    if (usernameFirst && source.supportedIdentifiers.includes("username") && username) {
      signals = [username];
      query = quote(username.value.replace(/^@/, ""));
      reason = "Username social pivot";
    } else if (source.id === "epieos" && source.supportedIdentifiers.includes("email") && email) {
      signals = [email];
      query = quote(email.value);
      reason = "Email source pivot";
    } else if (source.supportedIdentifiers.includes("name") && primaryName) {
      signals = [primaryName];
      query = quote(primaryName.value);
      const context =
        (source.id === "linkedin" ? employers[0] || schools[0] : locations[0]) ||
        employers[0];
      if (context) {
        signals.push(context);
        query += ` ${quote(context.value)}`;
      }
    } else if (source.supportedIdentifiers.includes("email") && email) {
      signals = [email];
      query = quote(email.value);
      reason = "Email source pivot";
    } else if (source.supportedIdentifiers.includes("phone") && phone) {
      signals = [phone];
      query = quote(phone.value);
      reason = "Phone source pivot";
    }
    if (!query || (options.seedIdentifierIds?.length && !signals.some((i) => seedIds.has(i.id))))
      continue;
    const host = new URL(source.homepage).hostname.replace(/^www\./, "");
    const site = source.id === "linkedin" ? "linkedin.com/in" : host;
    const siteQuery = `site:${site} ${query}`;
    add({
      query: source.interaction === "manual" ? query : siteQuery,
      reason,
      targetSourceId: source.id,
      targetSourceName: source.name,
      category: source.category,
      priority:
        (source.category === "ARREST" || source.id.includes("mugshot") ? 32 : source.priority) +
        (usernameFirst && username ? 0 : 5),
      searchPriority: username || email || phone ? "strong" : "medium",
      identifierIds: signals.map((i) => i.id),
      interaction: source.interaction,
      requiresIndependentVerification: requiresVerification,
    });
  }

  candidates.sort(
    (a, b) =>
      strengthRank[a.searchPriority] - strengthRank[b.searchPriority] ||
      a.priority - b.priority ||
      a.query.localeCompare(b.query) ||
      (a.targetSourceId || "").localeCompare(b.targetSourceId || ""),
  );
  const unique = candidates.filter(
    (candidate, index, all) =>
      all.findIndex(
        (other) =>
          normalizeQuery(other.query) === normalizeQuery(candidate.query) &&
          other.targetSourceId === candidate.targetSourceId &&
          other.interaction === candidate.interaction,
      ) === index,
  );
  const previous = new Set(
    history.map((entry) =>
      searchHistoryKey(entry.query, entry.engineSourceId, entry.targetSourceId),
    ),
  );
  let engineIndex = 0;
  const tasks: DeepSearchTask[] = [];
  for (const candidate of unique) {
    const engine =
      candidate.interaction === "manual"
        ? engines[0]
        : candidate.preferredEngine || engines[engineIndex++ % engines.length];
    const normalizedQuery = normalizeQuery(candidate.query);
    const target = candidate.targetSourceId
      ? sources.find((source) => source.id === candidate.targetSourceId)
      : undefined;
    const url =
      candidate.interaction === "manual" && target
        ? target.homepage
        : candidate.interaction === "direct" && target?.directTemplate
          ? target.directTemplate.replace(/\{[^{}]+\}/g, encodeURIComponent(candidate.query))
          : `${engineUrls[engine]}${encodeURIComponent(candidate.query)}`;
    const key = searchHistoryKey(candidate.query, engine, candidate.targetSourceId);
    if (
      candidate.interaction === "manual" &&
      history.some(
        (entry) =>
          entry.targetSourceId === candidate.targetSourceId &&
          entry.normalizedQuery === normalizedQuery,
      )
    )
      continue;
    if (!options.includePreviouslySearched && previous.has(key)) continue;
    tasks.push({
      ...candidate,
      id: stableId(key),
      normalizedQuery,
      url,
      engineSourceId: engine,
      status: "planned",
      enabled: true,
    });
  }
  if (!options.seedIdentifierIds?.length && engines.length > 1) {
    for (const sourceTask of tasks.filter((task) => task.priority <= 9).slice(0, 2)) {
      const engine = engines.find((item) => item !== sourceTask.engineSourceId);
      if (!engine || sourceTask.interaction === "manual") continue;
      const key = searchHistoryKey(sourceTask.query, engine, sourceTask.targetSourceId);
      if (!options.includePreviouslySearched && previous.has(key)) continue;
      tasks.push({
        ...sourceTask,
        id: stableId(key),
        engineSourceId: engine,
        url: `${engineUrls[engine]}${encodeURIComponent(sourceTask.query)}`,
        reason: `${sourceTask.reason} · Cross-engine verification`,
      });
    }
  }
  return tasks
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, options.maxTasks));
}

export function createSearchRun(
  c: ResearchCase,
  sources: ResearchSource[],
  options: DeepSearchOptions,
): SearchRun {
  const tasks = buildDeepSearchPlan(c, sources, options);
  const timestamp = now();
  return {
    id: uuid(),
    caseId: c.id,
    createdAt: timestamp,
    updatedAt: timestamp,
    status: "planned",
    wave: c.searchRuns.length + 1,
    kind: options.seedIdentifierIds?.length ? "continuation" : "initial",
    seedIdentifierIds: options.seedIdentifierIds || approvedIdentifiers(c).map((i) => i.id),
    tasks,
    currentTaskIndex: 0,
    opened: 0,
    skipped: 0,
    completed: 0,
  };
}

export function unusedExpansionIdentifiers(c: ResearchCase) {
  const used = new Set([
    ...c.searchHistory.flatMap((entry) => entry.identifierIds),
    ...c.searchRuns.flatMap((run) => run.seedIdentifierIds),
  ]);
  return c.identifiers.filter(
    (identifier) =>
      ["analyst_supplied", "verified"].includes(identifier.status) &&
      !used.has(identifier.id),
  );
}
