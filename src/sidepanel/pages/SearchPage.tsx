import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Copy, Search, SlidersHorizontal } from "lucide-react";
import {
  activity,
  categories,
  identifierTypes,
  makeIdentifier,
  now,
  statuses,
  type Identifier,
} from "../../types";
import { categoryLabels } from "../../config/researchSources";
import { buildQueries, buildSearchUrl } from "../../services/queryBuilder";
import { request } from "../../services/storage";
import { useWorkspace } from "../workspace";
import { Field, Section, human } from "../components/ui";

export function SearchPage({
  initial,
  sourceId,
}: {
  initial?: Identifier;
  sourceId?: string;
}) {
  const { c, state, run, refresh, save, notify, windowId } = useWorkspace();
  const [identifier, setIdentifier] = useState(
    initial || makeIdentifier("name", c?.subjectName || ""),
  );
  const [selected, setSelected] = useState<string[]>(
    sourceId ? [sourceId] : ["google"],
  );
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (initial) setIdentifier(initial);
    if (sourceId) setSelected([sourceId]);
  }, [initial, sourceId]);

  if (!c) return null;

  const sources = state.settings.sources.filter((s) => s.enabled);
  const selectedCount = selected.filter((id) => sources.some((s) => s.id === id)).length;

  const recommended = useMemo(() => {
    const map: Partial<Record<Identifier["type"], string[]>> = {
      name: ["google", "bing", "whitepages", "spokeo", "radaris", "facebook", "linkedin"],
      alias: ["google", "bing", "idcrawl", "facebook", "instagram"],
      username: ["google", "whatsmyname", "idcrawl", "instagram", "x", "reddit"],
      email: ["google", "epieos", "bing"],
      phone: ["google", "epieos", "whitepages", "spokeo"],
      employer: ["google", "linkedin", "rocketreach"],
      website: ["google", "bing", "duckduckgo", "google-review-date-finder"],
    };
    const preferred = map[identifier.type] || ["google", "bing", "duckduckgo"];
    return preferred.filter((id) => {
      const source = sources.find((s) => s.id === id);
      return source?.supportedIdentifiers.includes(identifier.type);
    });
  }, [identifier.type, sources]);

  const launch = () =>
    void run(async () => {
      const ids = selected.filter((id) => sources.some((s) => s.id === id));
      if (!identifier.value.trim()) throw Error("Enter an identifier or query first.");
      if (!ids.length) throw Error("Select at least one source.");
      const confirmed =
        ids.length > 10
          ? confirm(`You are about to open ${ids.length} research tabs. Continue?`)
          : false;
      if (ids.length > 10 && !confirmed) return;
      ids.forEach((id) =>
        buildSearchUrl(sources.find((s) => s.id === id)!, identifier, c),
      );
      setBusy(true);
      try {
        const result = await request<{ opened: number; errors: string[] }>({
          kind: "launch",
          caseId: c.id,
          identifier,
          sourceIds: ids,
          confirmed,
          windowId,
        });
        await refresh();
        notify(
          `Opened ${result.opened} research tabs for “${identifier.value}”. ${result.errors.join(" ")}`,
        );
      } finally {
        setBusy(false);
      }
    });

  return (
    <>
      <div className="page-title compact-title">
        <span className="eyebrow">SEARCH</span>
        <h1>Search sources.</h1>
        <p>Start with one identifier, choose where to look, then review results yourself.</p>
      </div>

      <section className="search-workflow" aria-label="Search workflow">
        <div className="workflow-step">
          <div className="step-marker">1</div>
          <div className="step-body">
            <div className="step-heading">
              <div>
                <span className="eyebrow">SEARCH FOR</span>
                <strong>{identifier.value || "Choose an identifier"}</strong>
              </div>
              <span className="type-label">{human(identifier.type)}</span>
            </div>

            <Field label="Known identifier">
              <select
                value={c.identifiers.some((i) => i.id === identifier.id) ? identifier.id : ""}
                onChange={(e) => {
                  const i = c.identifiers.find((i) => i.id === e.target.value);
                  if (i) setIdentifier(i);
                }}
              >
                <option value="">Custom input</option>
                {c.identifiers.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.value} · {human(i.type)}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Identifier or query">
              <div className="input-action">
                <input
                  value={identifier.value}
                  onChange={(e) =>
                    setIdentifier({
                      ...identifier,
                      id: crypto.randomUUID(),
                      value: e.target.value,
                    })
                  }
                />
                <button
                  className="icon"
                  aria-label="Copy search input"
                  title="Copy search input"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(identifier.value);
                      notify("Search input copied.");
                    })
                  }
                >
                  <Copy size={16} />
                </button>
              </div>
            </Field>

            <details className="quiet-disclosure">
              <summary>
                <SlidersHorizontal size={14} />
                Change identifier type
              </summary>
              <Field label="Identifier type">
                <select
                  value={identifier.type}
                  onChange={(e) =>
                    setIdentifier({
                      ...identifier,
                      type: e.target.value as Identifier["type"],
                    })
                  }
                >
                  {identifierTypes.map((t) => (
                    <option key={t} value={t}>
                      {human(t)}
                    </option>
                  ))}
                </select>
              </Field>
            </details>
          </div>
        </div>

        <div className="workflow-step">
          <div className="step-marker">2</div>
          <div className="step-body">
            <div className="step-heading source-pick-heading">
              <div>
                <span className="eyebrow">SEARCH SOURCES</span>
                <strong>{selectedCount} selected</strong>
              </div>
              <div className="selection-actions">
                <button className="text-button" onClick={() => setSelected(recommended)}>
                  Select recommended
                </button>
                <button className="text-button muted-action" onClick={() => setSelected([])}>
                  Clear
                </button>
              </div>
            </div>

            <input
              className="source-filter"
              placeholder="Find a source…"
              aria-label="Filter sources"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />

            <div className="source-groups">
              {categories.map((category) => {
                const group = sources.filter((s) => s.category === category);
                const visible = group.filter((s) =>
                  s.name.toLowerCase().includes(filter.toLowerCase()),
                );
                if (!visible.length) return null;
                const checked = group.filter(
                  (s) =>
                    c.checklist[s.id]?.status &&
                    c.checklist[s.id].status !== "not_checked",
                ).length;
                const selectedInGroup = group.filter((s) => selected.includes(s.id)).length;

                return (
                  <details
                    className="source-category warm-source-category"
                    key={category}
                    open={filter ? true : category === "GSR"}
                  >
                    <summary>
                      <span>
                        <strong>{categoryLabels[category]}</strong>
                        <small>
                          {selectedInGroup ? `${selectedInGroup} selected · ` : ""}
                          {checked}/{group.length} reviewed
                        </small>
                      </span>
                      <span className="count">{group.length}</span>
                    </summary>

                    <div className="source-list warm-source-list">
                      {visible.map((source) => {
                        const item = c.checklist[source.id];
                        const supported = source.supportedIdentifiers.includes(identifier.type);
                        return (
                          <div className="source-row compact-source-row" key={source.id}>
                            <div className="source-main-row">
                              <label className="check-label source-choice">
                                <input
                                  type="checkbox"
                                  disabled={!supported}
                                  checked={selected.includes(source.id)}
                                  onChange={(e) =>
                                    setSelected(
                                      e.target.checked
                                        ? [...selected, source.id]
                                        : selected.filter((x) => x !== source.id),
                                    )
                                  }
                                />
                                <span>
                                  <strong>{source.name}</strong>
                                  <small>
                                    {!supported
                                      ? `Not available for ${human(identifier.type)}`
                                      : source.strategy === "homepage"
                                        ? "Manual search"
                                        : "Direct search"}
                                  </small>
                                </span>
                              </label>

                              <select
                                className="source-status"
                                aria-label={`${source.name} status`}
                                value={item?.status || "not_checked"}
                                onChange={(e) =>
                                  void run(async () => {
                                    const next = structuredClone(c);
                                    next.checklist[source.id] = {
                                      sourceId: source.id,
                                      status: e.target.value as (typeof statuses)[number],
                                      notes: item?.notes || "",
                                      updatedAt: now(),
                                    };
                                    activity(next, "source", `${source.name}: ${human(e.target.value)}`);
                                    await save(next);
                                  })
                                }
                              >
                                {statuses.map((s) => (
                                  <option key={s} value={s}>
                                    {s === "finding_found" ? "Finding" : human(s)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <details className="source-detail-disclosure">
                              <summary>Notes & source info</summary>
                              <p>{source.notes}</p>
                              <form
                                key={item?.updatedAt || "new"}
                                className="inline-form"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const data = new FormData(e.currentTarget);
                                  void run(async () => {
                                    const next = structuredClone(c);
                                    next.checklist[source.id] = {
                                      sourceId: source.id,
                                      status: item?.status || "not_checked",
                                      notes: String(data.get("note")),
                                      updatedAt: now(),
                                    };
                                    activity(next, "note", `${source.name} research note updated`);
                                    await save(next);
                                  });
                                }}
                              >
                                <input
                                  aria-label={`${source.name} note`}
                                  name="note"
                                  placeholder="Add a source note…"
                                  defaultValue={item?.notes}
                                />
                                <button>Save</button>
                              </form>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>

        <div className="workflow-step final-step">
          <div className="step-marker">3</div>
          <div className="step-body">
            <button disabled={busy} className="primary full search-primary" onClick={launch}>
              <ArrowUpRight size={16} />
              {busy ? "Opening searches…" : `Open searches · ${selectedCount}`}
            </button>
            <p className="hint">
              Homepage sources open for manual entry. Opening a source marks it searched, never verified.
            </p>
          </div>
        </div>
      </section>

      <Section title="Query workbench" description="Optional query variations for broader searching.">
        <details className="quiet-disclosure query-disclosure">
          <summary>Show prepared queries</summary>
          <div className="query-list">
            {buildQueries(c).map((q) => (
              <div key={q}>
                <code>{q}</code>
                <button
                  className="icon"
                  aria-label={`Use query ${q}`}
                  title="Use this query"
                  onClick={() => {
                    setIdentifier(makeIdentifier("name", q));
                    setSelected(["google"]);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <Search size={15} />
                </button>
                <button
                  className="icon"
                  aria-label={`Copy query ${q}`}
                  title="Copy query"
                  onClick={() =>
                    void run(async () => {
                      await navigator.clipboard.writeText(q);
                      notify("Query copied.");
                    })
                  }
                >
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </details>
      </Section>

      <Section title="Case tabs" description="Browser housekeeping for this case only.">
        <details className="quiet-disclosure">
          <summary>Manage research tabs</summary>
          <div className="button-grid tab-actions-grid">
            {[
              ["focus", "Open research tabs"],
              ["group", "Group current tab"],
              ["ungroup", "Ungroup tabs"],
              ["close", "Close case research tabs"],
            ].map(([action, label]) => (
              <button
                key={action}
                onClick={() => {
                  if (action === "close" && !confirm("Close all tracked research tabs for this case?")) return;
                  void run(async () => {
                    await request({ kind: "tabs", caseId: c.id, action, windowId });
                    notify(`${label}: completed.`);
                  });
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="hint">Ungrouping releases tab ownership. Tabs are tracked only for this browser session.</p>
        </details>
      </Section>
    </>
  );
}
