import {
  activity,
  caseSchema,
  createCase,
  stateSchema,
  type AppState,
  type ResearchCase,
  type ExtensionSettings,
} from "../types";
import { defaultSources } from "../config/researchSources";
import { normalizeQuery } from "./deepSearch";
export const storageKey = "research-companion";
export const inExtension = () =>
  typeof chrome !== "undefined" && !!chrome.runtime?.id;
export const emptyState = (): AppState => ({
  schemaVersion: 2,
  activeCaseId: null,
  cases: [],
  settings: {
    theme: "light",
    sources: structuredClone(defaultSources),
    deepSearch: {
      defaultTaskLimit: 36,
      continuationTaskLimit: 18,
      batchSize: 5,
      includePublicRecords: false,
      preferredEngines: ["google", "bing", "duckduckgo"],
    },
  },
});
export function migrate(raw: unknown): AppState {
  if (raw == null) return emptyState();
  let candidate = structuredClone(raw) as Record<string, any>;
  if (candidate?.schemaVersion === 1) {
    const defaults = emptyState();
    candidate.schemaVersion = 2;
    candidate.cases = Array.isArray(candidate.cases)
      ? candidate.cases.map((c: Record<string, any>) => {
          const legacyRunId = crypto.randomUUID();
          const searches = Array.isArray(c.searches) ? c.searches : [];
          return {
            ...c,
            identifiers: Array.isArray(c.identifiers)
              ? c.identifiers.map((identifier: Record<string, any>) => ({
                  ...identifier,
                  status:
                    identifier.status === "verified"
                      ? "verified"
                      : identifier.source === "Analyst entry"
                        ? "analyst_supplied"
                        : "unverified_lead",
                }))
              : [],
            searchRuns: [],
            searchHistory: searches.map((search: Record<string, any>) => ({
              id: crypto.randomUUID(),
              searchRunId: legacyRunId,
              taskId: `legacy-${search.id}`,
              query: search.query,
              normalizedQuery: normalizeQuery(search.query),
              engineSourceId: ["google", "bing", "duckduckgo"].includes(search.sourceId)
                ? search.sourceId
                : "google",
              targetSourceId: ["google", "bing", "duckduckgo"].includes(search.sourceId)
                ? undefined
                : search.sourceId,
              identifierIds: [],
              url: search.url,
              timestamp: search.at,
              status: "opened",
            })),
            leads: [],
          };
        })
      : candidate.cases;
    candidate.settings = {
      ...candidate.settings,
      deepSearch: defaults.settings.deepSearch,
      sources: Array.isArray(candidate.settings?.sources)
        ? candidate.settings.sources.map((source: Record<string, any>) => {
            const fallback = defaultSources.find((item) => item.id === source.id);
            return {
              ...source,
              interaction:
                fallback?.interaction ||
                (source.strategy === "template" ? "direct" : "manual"),
              directTemplate: fallback?.directTemplate || source.template || "",
              priority: fallback?.priority || 50,
              requiresLogin: fallback?.requiresLogin || false,
              potentiallyBlocked: fallback?.potentiallyBlocked || false,
            };
          })
        : candidate.settings?.sources,
    };
  }
  const result = stateSchema.safeParse(candidate);
  if (!result.success)
    throw Error(
      "Stored workspace is malformed or uses an unsupported schema. Your original data has been preserved. Export a recovery backup before resetting.",
    );
  return result.data;
}
export async function readState() {
  const raw = inExtension()
    ? (await chrome.storage.local.get(storageKey))[storageKey]
    : JSON.parse(localStorage.getItem(storageKey) || "null");
  return migrate(raw);
}
export async function writeState(state: AppState) {
  const checked = stateSchema.parse(state);
  if (inExtension()) await chrome.storage.local.set({ [storageKey]: checked });
  else {
    localStorage.setItem(storageKey, JSON.stringify(checked));
    window.dispatchEvent(new Event("workspace-change"));
  }
}
export type Mutation =
  | { type: "create"; name: string }
  | { type: "save"; data: ResearchCase; expected: string }
  | { type: "select"; id: string | null }
  | { type: "delete"; id: string }
  | { type: "archive"; id: string }
  | { type: "duplicate"; id: string }
  | { type: "import"; data: ResearchCase }
  | { type: "settings"; settings: ExtensionSettings; expected: string };
export function applyMutation(state: AppState, cmd: Mutation) {
  const get = (id: string) => {
    const c = state.cases.find((x) => x.id === id);
    if (!c) throw Error("Case no longer exists.");
    return c;
  };
  if (cmd.type === "create") {
    const c = createCase(cmd.name);
    state.cases.push(caseSchema.parse(c));
    state.activeCaseId = c.id;
  }
  if (cmd.type === "save") {
    const current = get(cmd.data.id);
    if (current.modifiedAt !== cmd.expected)
      throw Error(
        "This case changed in another panel. Reloaded the latest version; please retry your edit.",
      );
    const c = caseSchema.parse(cmd.data);
    // Captured provenance is immutable even if a caller edits its display fields.
    for (const finding of c.findings) {
      const original = current.findings.find((f) => f.id === finding.id);
      if (original) {
        finding.provenance = structuredClone(original.provenance);
        finding.capturedAt = original.capturedAt;
      }
    }
    c.modifiedAt = new Date(
      Math.max(Date.now(), Date.parse(current.modifiedAt) + 1),
    ).toISOString();
    state.cases[state.cases.findIndex((x) => x.id === c.id)] = c;
  }
  if (cmd.type === "select") {
    if (cmd.id) get(cmd.id);
    state.activeCaseId = cmd.id;
  }
  if (cmd.type === "delete") {
    get(cmd.id);
    state.cases = state.cases.filter((c) => c.id !== cmd.id);
    if (state.activeCaseId === cmd.id)
      state.activeCaseId = state.cases.find((c) => !c.archived)?.id || null;
  }
  if (cmd.type === "archive") {
    const c = get(cmd.id);
    c.archived = !c.archived;
    activity(c, "case", c.archived ? "Case archived" : "Case restored");
  }
  if (cmd.type === "duplicate") {
    const c = structuredClone(get(cmd.id));
    const runIds = new Map(c.searchRuns.map((run) => [run.id, crypto.randomUUID()]));
    c.id = crypto.randomUUID();
    c.subjectName += " (copy)";
    c.createdAt = new Date().toISOString();
    c.archived = false;
    c.findings.forEach((f) => (f.caseId = c.id));
    c.leads.forEach((lead) => {
      lead.id = crypto.randomUUID();
      lead.caseId = c.id;
    });
    c.searchRuns.forEach((run) => {
      run.id = runIds.get(run.id)!;
      run.caseId = c.id;
    });
    c.searchHistory.forEach((entry) => {
      entry.id = crypto.randomUUID();
      entry.searchRunId = runIds.get(entry.searchRunId) || entry.searchRunId;
    });
    activity(c, "case", "Case duplicated; original provenance retained");
    state.cases.push(c);
    state.activeCaseId = c.id;
  }
  if (cmd.type === "import") {
    const c = caseSchema.parse(cmd.data);
    if (state.cases.some((x) => x.id === c.id))
      throw Error(
        "A case with this ID already exists. Import will not overwrite it.",
      );
    state.cases.push(c);
    state.activeCaseId = c.id;
  }
  if (cmd.type === "settings") {
    if (JSON.stringify(state.settings) !== cmd.expected)
      throw Error("Settings changed in another panel. Please retry your edit.");
    state.settings = cmd.settings;
  }
  return state;
}
let queue: Promise<unknown> = Promise.resolve();
export function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}
export async function executeMutation(cmd: Mutation) {
  const s = await readState();
  applyMutation(s, cmd);
  await writeState(s);
  return s;
}
export async function request<T>(message: unknown): Promise<T> {
  if (!inExtension())
    throw Error(
      "This browser action is available after loading the extension in Chrome.",
    );
  const response = await chrome.runtime.sendMessage(message);
  if (!response?.ok)
    throw Error(
      response?.error || "The browser action could not be completed.",
    );
  return response.data;
}
export async function mutate(cmd: Mutation): Promise<AppState> {
  return inExtension()
    ? request({ kind: "mutate", cmd })
    : serial(() => executeMutation(cmd));
}
export const CaseRepository = {
  createCase: (name: string) => mutate({ type: "create", name }),
  getCase: async (id: string) =>
    (await readState()).cases.find((c) => c.id === id),
  getAllCases: async () => (await readState()).cases,
  updateCase: (data: ResearchCase, expected: string) =>
    mutate({ type: "save", data, expected }),
  deleteCase: (id: string) => mutate({ type: "delete", id }),
  archiveCase: (id: string) => mutate({ type: "archive", id }),
};
export const SettingsRepository = {
  save: (settings: ExtensionSettings, previous: ExtensionSettings) =>
    mutate({ type: "settings", settings, expected: JSON.stringify(previous) }),
};
export async function rawBackup() {
  return inExtension()
    ? await chrome.storage.local.get(null)
    : { [storageKey]: localStorage.getItem(storageKey) };
}
