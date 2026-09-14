import React, { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  FilePlus2,
  FolderOpen,
  Settings,
  ShieldCheck,
  Search,
  X,
  Plus,
  Upload,
  ArrowUpRight,
} from "lucide-react";
import {
  type AppState,
  type CaptureDraft,
  type Identifier,
  type ResearchCase,
  makeIdentifier,
  now,
  activity,
} from "../types";
import {
  inExtension,
  readState,
  mutate,
  request,
  rawBackup,
} from "../services/storage";
import { download, importCase } from "../services/exportImport";
import { recognizeSource } from "../config/researchSources";
import { WorkspaceContext } from "./workspace";
import { CasePage } from "./pages/CasePage";
import { SearchPage } from "./pages/SearchPage";
import { FindingsPage } from "./pages/FindingsPage";
import { ComparePage } from "./pages/ComparePage";
import { ReportPage } from "./pages/ReportPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LeadsPage } from "./pages/LeadsPage";
import { HistoryPage } from "./pages/HistoryPage";
import { IdentifierEditor } from "./components/IdentifierEditor";
import { Empty, Field, Modal } from "./components/ui";
import { detectIdentifierType } from "../services/queryBuilder";
const tabs = ["CASE", "DEEP SEARCH", "LEADS", "COMPARE", "HISTORY"];
export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [fatal, setFatal] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [page, setPage] = useState("CASE");
  const [newCase, setNewCase] = useState(false);
  const [identifier, setIdentifier] = useState<Identifier | undefined | null>(
    null,
  );
  const [pivotValue, setPivotValue] = useState<Identifier>();
  const [pivotSource, setPivotSource] = useState<string>();
  const [globalSearch, setGlobalSearch] = useState<string | null>(null);
  const [draft, setDraft] = useState<CaptureDraft | null>(null);
  const [activeTab, setActiveTab] = useState<chrome.tabs.Tab>();
  const [windowId, setWindowId] = useState<number>();
  const refresh = useCallback(async () => {
    try {
      setState(await readState());
      setFatal("");
    } catch (e) {
      setFatal(e instanceof Error ? e.message : "Unable to load local data.");
      throw e;
    }
  }, []);
  const run = useCallback(
    async (fn: () => Promise<unknown>) => {
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Unable to complete this action.",
        );
        try {
          await refresh();
        } catch {}
      }
    },
    [refresh],
  );
  useEffect(() => {
    void refresh().catch(() => {});
    const changed = () => void refresh().catch(() => {});
    if (inExtension()) {
      chrome.storage.onChanged.addListener(changed);
      void chrome.windows.getCurrent().then((w) => setWindowId(w.id));
      return () => chrome.storage.onChanged.removeListener(changed);
    }
    window.addEventListener("workspace-change", changed);
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("workspace-change", changed);
      window.removeEventListener("storage", changed);
    };
  }, [refresh]);
  useEffect(() => {
    if (!inExtension() || !windowId) return;
    const update = () => {
      void chrome.tabs
        .query({ active: true, windowId })
        .then((t) => setActiveTab(t[0]))
        .catch((e) => setError(String(e)));
    };
    update();
    chrome.tabs.onActivated.addListener(update);
    chrome.tabs.onUpdated.addListener(update);
    return () => {
      chrome.tabs.onActivated.removeListener(update);
      chrome.tabs.onUpdated.removeListener(update);
    };
  }, [windowId]);
  useEffect(() => {
    if (!inExtension()) return;
    const update = () => {
      void chrome.storage.session
        .get(["drafts", "captureError"])
        .then(({ drafts = [], captureError }) => {
          setDraft(drafts[0] || null);
          if (captureError) setError(captureError);
        })
        .catch((e) => setError(String(e)));
    };
    update();
    chrome.storage.onChanged.addListener(update);
    return () => chrome.storage.onChanged.removeListener(update);
  }, []);
  const c = state?.cases.find((c) => c.id === state.activeCaseId) || null;
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [page, c?.id]);
  useEffect(() => {
    setIdentifier(null);
    setPivotValue(undefined);
    setPivotSource(undefined);
  }, [c?.id]);
  const dismissDraft = async () => {
    if (draft) await request({ kind: "dismiss-draft", id: draft.id });
    setDraft(null);
  };
  const draftMatches = !!c && (!draft?.caseId || draft.caseId === c.id);
  useEffect(() => {
    if (!draft || !draftMatches) return;
    if (draft.mode === "finding") setPage("FINDINGS");
    if (draft.mode === "lead") setPage("LEADS");
  }, [draft?.id, draftMatches]);
  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.settings.theme;
  }, [state?.settings.theme]);
  const save = async (next: ResearchCase) => {
    if (!c) throw Error("No active case selected.");
    const updated = await mutate({
      type: "save",
      data: next,
      expected: c.modifiedAt,
    });
    setState(updated);
  };
  const pivot = (i: Identifier, sourceId?: string) => {
    setPivotValue({ ...i });
    setPivotSource(sourceId);
    setPage("DEEP SEARCH");
  };
  const capture = async (mode: "finding" | "identifier" | "lead") => {
    await request({ kind: "capture", mode, windowId });
  };
  if (fatal)
    return (
      <main className="recovery">
        <ShieldCheck />
        <h1>Workspace needs attention</h1>
        <p role="alert">{fatal}</p>
        <button
          onClick={() =>
            void run(async () =>
              download(
                "research-recovery.json",
                JSON.stringify(await rawBackup(), null, 2),
              ),
            )
          }
        >
          Export recovery backup
        </button>
        <p>
          No records have been replaced. Restore a known-good backup after
          reviewing the exported data.
        </p>
      </main>
    );
  if (!state) return <div className="empty">Opening your local workspace…</div>;
  const source = recognizeSource(activeTab?.url || "", state.settings.sources);
  const enabled = state.settings.sources.filter((s) => s.enabled);
  const checked = c
    ? new Set(c.searchHistory.map((entry) => entry.targetSourceId || entry.engineSourceId)).size
    : 0;
  return (
    <WorkspaceContext.Provider
      value={{
        state,
        c,
        save,
        run,
        notify: setNotice,
        refresh,
        navigate: setPage,
        editIdentifier: setIdentifier,
        pivot,
        capture,
        draft: draftMatches ? draft : null,
        dismissDraft,
        windowId,
      }}
    >
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <div className="brand-icon">
              <BookOpen size={18} />
            </div>
            <span>
              RESEARCH
              <br />
              <b>COMPANION</b>
            </span>
          </div>
          <div className="header-actions">
            <button
              className="icon"
              aria-label="Search all cases"
              onClick={() => setGlobalSearch("")}
            >
              <Search size={18} />
            </button>
            <button
              className={"icon " + (page === "SETTINGS" ? "active" : "")}
              aria-label="Settings"
              onClick={() => setPage(page === "SETTINGS" ? "CASE" : "SETTINGS")}
            >
              <Settings size={18} />
            </button>
          </div>
        </header>
        <div className="case-bar">
          <div className="case-symbol">
            <FolderOpen size={19} />
          </div>
          <label>
            <span>CURRENT CASE</span>
            <select
              aria-label="Current case"
              value={state.activeCaseId || ""}
              onChange={(e) =>
                void run(async () => {
                  await mutate({ type: "select", id: e.target.value || null });
                  await refresh();
                  setPage("CASE");
                })
              }
            >
              <option value="">Select a case</option>
              {state.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.archived ? "[Archived] " : ""}
                  {c.demo ? "[Demo] " : ""}
                  {c.subjectName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon"
            onClick={() => setNewCase(true)}
            aria-label="Create case"
          >
            <Plus size={19} />
          </button>
        </div>
        <nav aria-label="Workspace sections">
          {tabs.map((t) => (
            <button
              key={t}
              aria-current={page === t ? "page" : undefined}
              onClick={() => setPage(t)}
            >
              {t}
            </button>
          ))}
        </nav>
        {c && (
          <div className="progress-row">
            <span className="progress-track">
              <span
                style={{
                  width: `${enabled.length ? (checked / enabled.length) * 100 : 0}%`,
                }}
              />
            </span>
            <span>
              {checked}/{enabled.length} sources searched
            </span>
          </div>
        )}
        <main>
          {!inExtension() && (
            <div className="preview-note">
              LOCAL PREVIEW · Browser actions require the installed extension.
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <span>{error}</span>
              <button
                className="icon"
                aria-label="Dismiss error"
                onClick={() => {
                  setError("");
                  if (inExtension())
                    void chrome.storage.session.remove("captureError");
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button
                className="icon"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {draft && !draftMatches && (
            <div className="notice">
              {c
                ? "A capture is waiting for another case. Select that case or assign it to this one."
                : "A capture is waiting. Create or select a case to continue."}
              {c && (
                <button onClick={() => setDraft({ ...draft, caseId: c.id })}>
                  Use this case
                </button>
              )}
              <button onClick={() => void run(dismissDraft)}>
                Discard capture
              </button>
            </div>
          )}
          {page === "SETTINGS" ? (
            <SettingsPage />
          ) : !c ? (
            <Empty
              title="Your research starts here."
              action={
                <button className="primary" onClick={() => setNewCase(true)}>
                  <FilePlus2 size={17} />
                  Create a case
                </button>
              }
            >
              A focused workspace for identifiers, findings, and the connections
              between them.
              <div className="welcome-points">
                <span>
                  01 <b>Collect identifiers</b>
                </span>
                <span>
                  02 <b>Research & capture</b>
                </span>
                <span>
                  03 <b>Compare & assess</b>
                </span>
              </div>
            </Empty>
          ) : (
            <React.Fragment key={c.id}>
              {page === "CASE" && <CasePage />}
              {page === "DEEP SEARCH" && <SearchPage />}{" "}
              {page === "LEADS" && <LeadsPage />}
              {page === "COMPARE" && <ComparePage />}
              {page === "HISTORY" && <HistoryPage />}
              {page === "REPORT" && <ReportPage />}
              {page === "FINDINGS" && <FindingsPage />}
            </React.Fragment>
          )}
          {!c && (
            <div className="welcome-import">
              <label className="button">
                <Upload size={15} />
                Import a case
                <input
                  type="file"
                  accept=".json,application/json"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file)
                      void run(async () => {
                        if (file.size > 10_000_000)
                          throw Error("The imported file exceeds 10 MB.");
                        await mutate({
                          type: "import",
                          data: importCase(await file.text()),
                        });
                        await refresh();
                      });
                  }}
                />
              </label>
            </div>
          )}
        </main>
        {c && (
          <aside className="current-source">
            <div>
              <span className="eyebrow">CURRENT SOURCE</span>
              <strong>
                {source?.name || activeTab?.url
                  ? source?.name || "Unrecognized source"
                  : "No research page selected"}
              </strong>
              {source && (
                <small>
                  {source.category} · {categoryLabel(source.category)}
                </small>
              )}
            </div>
            <div className="source-actions">
              {source && (
                <button
                  title="Mark current source searched"
                  aria-label="Mark current source searched"
                  onClick={() =>
                    void run(async () => {
                      const next = structuredClone(c);
                      next.checklist[source.id] = {
                        sourceId: source.id,
                        status: "searched",
                        notes: next.checklist[source.id]?.notes || "",
                        updatedAt: now(),
                      };
                      activity(
                        next,
                        "source",
                        `${source.name} marked searched by analyst`,
                      );
                      await save(next);
                    })
                  }
                >
                  ✓
                </button>
              )}
              <button onClick={() => void run(() => capture("finding"))}>
                Finding
              </button>
              <button onClick={() => void run(() => capture("lead"))}>Lead</button>
              <button
                aria-label="Add identifier from current page"
                onClick={() => void run(() => capture("identifier"))}
              >
                <Plus size={14} />
              </button>
            </div>
          </aside>
        )}
        <footer className="app-footer">
          <ShieldCheck size={12} />
          <span>Local storage only</span>
          <span className="footer-right">Human-led research</span>
        </footer>
      </div>
      {newCase && (
        <Modal title="Create a research case" close={() => setNewCase(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = String(
                new FormData(e.currentTarget).get("name"),
              ).trim();
              void run(async () => {
                if (!name) throw Error("Enter a subject name.");
                await mutate({ type: "create", name });
                await refresh();
                setPage("CASE");
                setNewCase(false);
              });
            }}
          >
            <Field
              label="Subject name"
              hint="You can add identifiers and other details next."
            >
              <input
                name="name"
                required
                autoFocus
                placeholder="e.g. Daniel Luis Ramirez"
              />
            </Field>
            <button className="primary">
              Create case
              <ChevronRight size={15} />
            </button>
          </form>
        </Modal>
      )}
      {identifier !== null && c && (
        <IdentifierEditor
          initial={identifier}
          close={() => setIdentifier(null)}
        />
      )}{" "}
      {draft && draftMatches && !["finding", "lead"].includes(draft.mode) && (
        <Modal
          title={
            draft.mode === "search"
              ? "Search selected text"
              : "Add selected identifier"
          }
          close={() => void run(dismissDraft)}
        >
          <p className="preserve">
            {draft.text || "No selected text. You can enter it in the editor."}
          </p>
          <p className="hint">
            From {draft.domain || "current page"} ·{" "}
            {new Date(draft.capturedAt).toLocaleString()}
          </p>
          <p className="hint">
            Suggested type:{" "}
            {detectIdentifierType(draft.text) ||
              "Uncertain — choose in the editor"}
          </p>
          <button
            className="primary"
            onClick={() =>
              void run(async () => {
                const i = makeIdentifier(
                  draft.identifierType ||
                    detectIdentifierType(draft.text) ||
                    "other",
                  draft.text,
                );
                i.source = draft.sourceUrl;
                i.notes = `Captured from ${draft.pageTitle} at ${draft.capturedAt}`;
                i.status = "unverified_lead";
                if (draft.mode === "search") pivot(i, draft.sourceId);
                else setIdentifier(i);
                await dismissDraft();
              })
            }
          >
            {draft.mode === "search" ? "Review search" : "Review identifier"}
            <ArrowUpRight size={14} />
          </button>
        </Modal>
      )}
      {globalSearch !== null && (
        <Modal
          title="Search all local cases"
          close={() => setGlobalSearch(null)}
        >
          <Field label="Name, identifier, finding, or notes">
            <input
              autoFocus
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
          </Field>
          {globalSearch.trim() &&
            state.cases.flatMap((c) => {
              const q = globalSearch.toLowerCase();
              const results = [
                ...(JSON.stringify([c.subjectName, c.profile, c.notes])
                  .toLowerCase()
                  .includes(q)
                  ? [{ label: c.subjectName, type: "Case", page: "CASE" }]
                  : []),
                ...c.identifiers
                  .filter((i) =>
                    `${i.value} ${i.notes}`.toLowerCase().includes(q),
                  )
                  .map((i) => ({
                    label: i.value,
                    type: "Identifier",
                    page: "CASE",
                  })),
                ...c.findings
                  .filter((f) =>
                    `${f.title} ${f.text} ${f.analystNote}`
                      .toLowerCase()
                      .includes(q),
                  )
                  .map((f) => ({
                    label: f.title,
                    type: "Finding",
                    page: "FINDINGS",
                  })),
              ];
              return results.map((r, index) => (
                <button
                  className="search-result"
                  key={c.id + index}
                  onClick={() =>
                    void run(async () => {
                      await mutate({ type: "select", id: c.id });
                      await refresh();
                      setPage(r.page);
                      setGlobalSearch(null);
                    })
                  }
                >
                  <span className="eyebrow">
                    {r.type} · {c.subjectName}
                  </span>
                  <strong>{r.label}</strong>
                </button>
              ));
            })}
        </Modal>
      )}
    </WorkspaceContext.Provider>
  );
}
function categoryLabel(s: string) {
  return s === "ARREST"
    ? "Public records — verify independently"
    : "Research source";
}
