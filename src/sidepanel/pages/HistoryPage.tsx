import { useState } from "react";
import { Section, human } from "../components/ui";
import { useWorkspace } from "../workspace";

export function HistoryPage() {
  const { c } = useWorkspace();
  const [filter, setFilter] = useState("");
  if (!c) return null;
  const entries = c.searchHistory.filter((entry) =>
    `${entry.query} ${entry.engineSourceId} ${entry.targetSourceId || ""}`.toLowerCase().includes(filter.toLowerCase()),
  );
  return (
    <>
      <div className="page-title compact-title">
        <span className="eyebrow">HISTORY</span>
        <h1>Every search wave, remembered.</h1>
        <p>Normalized queries prevent accidental repeats while preserving an auditable trail.</p>
      </div>
      <Section title={`${c.searchRuns.length} search waves`}>
        <div className="run-history">
          {c.searchRuns.slice().reverse().map((run) => (
            <article key={run.id}>
              <span className="eyebrow">WAVE {run.wave} · {human(run.kind)}</span>
              <strong>{run.tasks.length} tasks · {human(run.status)}</strong>
              <small>{new Date(run.createdAt).toLocaleString()} · {run.opened} open · {run.completed} reviewed · {run.skipped} skipped</small>
            </article>
          ))}
          {!c.searchRuns.length && <p className="hint">No Deep Search waves have been prepared.</p>}
        </div>
      </Section>
      <Section title={`${c.searchHistory.length} search events`}>
        <input aria-label="Filter search history" placeholder="Filter query, engine, or source…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="history-list">
          {entries.slice().reverse().map((entry) => (
            <article key={entry.id}>
              <span className="eyebrow">{human(entry.engineSourceId)}{entry.targetSourceId ? ` · ${entry.targetSourceId}` : ""}</span>
              <code>{entry.query}</code>
              <small>{human(entry.status)} · {new Date(entry.timestamp).toLocaleString()}</small>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
