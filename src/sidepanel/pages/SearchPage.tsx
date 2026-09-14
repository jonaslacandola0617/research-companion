import { useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { activity, type DeepSearchTask, type DeepSearchTaskStatus } from "../../types";
import { createSearchRun, unusedExpansionIdentifiers } from "../../services/deepSearch";
import { request } from "../../services/storage";
import { useWorkspace } from "../workspace";
import { Empty, Section, human } from "../components/ui";

const finishedStatuses: DeepSearchTaskStatus[] = [
  "reviewed",
  "useful_lead",
  "no_useful_result",
  "unavailable",
  "blocked",
  "skipped",
];

export function SearchPage() {
  const { c, state, save, run, refresh, notify, windowId, editIdentifier } = useWorkspace();
  const [includePublicRecords, setIncludePublicRecords] = useState(
    state.settings.deepSearch.includePublicRecords,
  );
  const [busy, setBusy] = useState(false);
  if (!c) return null;

  const latest = c.searchRuns.at(-1);
  const expansionIdentifiers = unusedExpansionIdentifiers(c);
  const verified = c.identifiers.filter((i) => i.status === "verified").length;
  const unverified = c.identifiers.length - verified;
  const tasks = latest?.tasks || [];
  const activeTasks = tasks.filter((task) => task.enabled);
  const completed = activeTasks.filter((task) => finishedStatuses.includes(task.status)).length;
  const opened = activeTasks.filter((task) => task.status === "opened").length;
  const planned = activeTasks.filter((task) => task.status === "planned");
  const progress = activeTasks.length ? ((completed + opened) / activeTasks.length) * 100 : 0;
  const counts: Record<string, number> = {};
  for (const task of activeTasks) counts[task.category] = (counts[task.category] || 0) + 1;

  const generate = (continuation = false) =>
    void run(async () => {
      const next = structuredClone(c);
      const seedIdentifierIds = continuation
        ? expansionIdentifiers.map((identifier) => identifier.id)
        : undefined;
      if (continuation && !seedIdentifierIds?.length)
        throw Error("No new analyst-approved identifiers are available for expansion.");
      const searchRun = createSearchRun(next, state.settings.sources, {
        maxTasks: continuation
          ? state.settings.deepSearch.continuationTaskLimit
          : state.settings.deepSearch.defaultTaskLimit,
        includePublicRecords,
        preferredEngines: state.settings.deepSearch.preferredEngines,
        seedIdentifierIds,
      });
      if (!searchRun.tasks.length)
        throw Error(
          continuation
            ? "Those identifiers produced no new searches. Previous queries and disabled sources were skipped."
            : "No searches could be prepared. Check the case identifiers and enabled sources.",
        );
      if (latest?.status === "planned" && !continuation)
        next.searchRuns[next.searchRuns.length - 1] = searchRun;
      else next.searchRuns.push(searchRun);
      activity(
        next,
        "search",
        `${continuation ? "Continuation" : "Deep Search"} wave prepared: ${searchRun.tasks.length} searches`,
      );
      await save(next);
      notify(`${searchRun.tasks.length} new searches prepared for analyst review.`);
    });

  const updatePlan = (updater: (tasks: DeepSearchTask[]) => DeepSearchTask[]) =>
    void run(async () => {
      if (!latest || latest.status !== "planned")
        throw Error("Only a planned run can be edited.");
      const next = structuredClone(c);
      const target = next.searchRuns.find((item) => item.id === latest.id)!;
      target.tasks = updater(target.tasks);
      target.updatedAt = new Date().toISOString();
      await save(next);
    });

  const nextBatch = () =>
    void run(async () => {
      if (!latest) return;
      setBusy(true);
      try {
        const result = await request<{ opened: number; errors: string[]; status: string }>({
          kind: "run-search-batch",
          caseId: c.id,
          runId: latest.id,
          windowId,
        });
        await refresh();
        notify(`Opened ${result.opened} searches. ${result.errors.join(" ")}`.trim());
      } finally {
        setBusy(false);
      }
    });

  const updateRun = (action: "pause" | "continue") =>
    void run(async () => {
      if (!latest) return;
      await request({ kind: "update-run", caseId: c.id, runId: latest.id, action });
      await refresh();
    });

  const updateTask = (taskId: string, status: DeepSearchTaskStatus) =>
    void run(async () => {
      if (!latest) return;
      await request({ kind: "update-search-task", caseId: c.id, runId: latest.id, taskId, status });
      await refresh();
    });

  const tabAction = (action: string) =>
    void run(async () => {
      await request({ kind: "tabs", caseId: c.id, action, windowId });
      notify("Research tab action completed.");
    });

  return (
    <>
      <div className="page-title compact-title deep-search-title">
        <span className="eyebrow">DEEP SEARCH</span>
        <h1>{c.subjectName}</h1>
        <p>{c.identifiers.length} known identifiers · {verified} verified · {unverified} supplied or unverified</p>
      </div>

      <div className="deep-search-actions">
        <button className="subtle" onClick={() => editIdentifier()}><Plus size={15} /> Add identifier</button>
        <label className="check-label public-record-toggle">
          <input type="checkbox" checked={includePublicRecords} onChange={(event) => setIncludePublicRecords(event.target.checked)} />
          Include public-record sources
        </label>
      </div>

      {!latest ? (
        <Empty
          title="Build the first search wave"
          action={<button className="primary" onClick={() => generate(false)}><Play size={16} /> Prepare Deep Search</button>}
        >
          The planner ranks identifier combinations, distributes them across engines, and caps the plan at {state.settings.deepSearch.defaultTaskLimit} tasks. Nothing opens until you approve a batch.
        </Empty>
      ) : (
        <>
          {expansionIdentifiers.length > 0 && latest.status !== "planned" && (
            <div className="notice expansion-notice">
              <span>{expansionIdentifiers.length} new analyst-approved identifier{expansionIdentifiers.length === 1 ? "" : "s"} available for expansion.</span>
              <button onClick={() => generate(true)}>Continue Deep Search</button>
            </div>
          )}

          <Section
            title={`Search plan · wave ${latest.wave}`}
            description={`${activeTasks.length} searches prepared · ${human(latest.kind)} wave · ${human(latest.status)}`}
            action={latest.status === "planned" ? <button className="text-button" onClick={() => generate(false)}><RefreshCw size={14} /> Regenerate</button> : undefined}
          >
            <div className="plan-summary">
              {Object.entries(counts).map(([category, count]) => <span key={category}><strong>{count}</strong> {categoryLabel(category)}</span>)}
            </div>
            <div className="research-progress" aria-label="Research progress">
              <div><strong>{completed + opened} / {activeTasks.length}</strong><span> searches opened or reviewed</span></div>
              <span className="progress-track"><span style={{ width: `${progress}%` }} /></span>
            </div>
            <div className="batch-actions">
              {latest.status === "paused" ? (
                <button className="primary" onClick={() => updateRun("continue")}><Play size={15} /> Continue run</button>
              ) : planned.length ? (
                <button className="primary" disabled={busy} onClick={nextBatch}><Play size={15} /> {busy ? "Opening…" : `Run next batch · ${Math.min(planned.length, state.settings.deepSearch.batchSize)}`}</button>
              ) : null}
              {latest.status === "running" && <button onClick={() => updateRun("pause")}><Pause size={15} /> Pause</button>}
            </div>
            <p className="hint">Searches open only in controlled batches. Manual tasks open the source homepage and show what to enter. No forms, login walls, CAPTCHAs, or identity decisions are automated.</p>
          </Section>

          <Section title={latest.status === "planned" ? "Preview search plan" : "Current search wave"}>
            <div className="deep-task-list">
              {tasks.map((task) => (
                <article className={`deep-task ${task.enabled ? "" : "disabled"}`} key={task.id}>
                  <div className="deep-task-top">
                    {latest.status === "planned" && (
                      <input aria-label={`Enable ${task.query}`} type="checkbox" checked={task.enabled} onChange={(event) => updatePlan((items) => items.map((item) => item.id === task.id ? { ...item, enabled: event.target.checked } : item))} />
                    )}
                    <div>
                      <span className="eyebrow">{task.targetSourceName || human(task.engineSourceId)} · {task.interaction === "manual" ? "MANUAL" : human(task.engineSourceId)}</span>
                      <code>{task.query}</code>
                    </div>
                    {latest.status === "planned" && <button className="icon" aria-label="Remove task" onClick={() => updatePlan((items) => items.filter((item) => item.id !== task.id))}><Trash2 size={14} /></button>}
                  </div>
                  <div className="deep-task-meta">
                    <span>{task.reason}</span>
                    <span className={`priority ${task.searchPriority}`}>{human(task.searchPriority)} priority</span>
                    <span>{human(task.status)}</span>
                  </div>
                  {task.requiresIndependentVerification && <p className="verification-warning">Requires independent verification. A shared name is not evidence of identity.</p>}
                  {task.status === "opened" && (
                    <div className="task-review-actions">
                      <a href={task.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>
                      <button onClick={() => updateTask(task.id, "useful_lead")}>Useful lead</button>
                      <button onClick={() => updateTask(task.id, "no_useful_result")}>No useful result</button>
                      <button onClick={() => updateTask(task.id, "blocked")}>Blocked</button>
                      <button className="icon" aria-label="Mark reviewed" onClick={() => updateTask(task.id, "reviewed")}><CheckCircle2 size={15} /></button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </Section>
        </>
      )}

      <Section title="Case research tabs" description="Only tabs created or explicitly grouped by this extension are managed.">
        <div className="button-grid">
          <button onClick={() => tabAction("focus")}>Focus research tabs</button>
          <button onClick={() => tabAction("close-completed")}>Close completed tabs</button>
          <button onClick={() => { if (confirm("Close all tracked research tabs for this case?")) tabAction("close"); }}>Close all case tabs</button>
        </div>
      </Section>
    </>
  );
}

function categoryLabel(category: string) {
  if (category === "GSR") return "General";
  if (category === "PSE") return "People search";
  if (category === "SEARCH") return "OSINT";
  if (category === "ARREST") return "Public records";
  return "Social media";
}
