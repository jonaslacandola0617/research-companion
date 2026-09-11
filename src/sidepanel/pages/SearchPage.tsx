import { useEffect, useState } from "react";
import { ArrowUpRight, Copy, Search } from "lucide-react";
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
  const launch = () =>
    void run(async () => {
      const ids = selected.filter((id) => sources.some((s) => s.id === id));
      if (!identifier.value.trim())
        throw Error("Enter an identifier or query first.");
      if (!ids.length) throw Error("Select at least one source.");
      const confirmed =
        ids.length > 10
          ? confirm(
              `You are about to open ${ids.length} research tabs. Continue?`,
            )
          : false;
      if (ids.length > 10 && !confirmed) return;
      ids.forEach((id) =>
        buildSearchUrl(
          sources.find((s) => s.id === id)!,
          identifier,
          c,
        ),
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
          `Opened ${result.opened} research tabs. Search for: ${identifier.value}. ${result.errors.join(" ")}`,
        );
      } finally {
        setBusy(false);
      }
    });
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">SEARCH & PIVOT</span>
        <h1>Follow an identifier.</h1>
        <p>Choose your sources. Research at your own pace.</p>
      </div>
      <Section title="Search input">
        <Field label="Use a known identifier">
          <select
            value={
              c.identifiers.some((i) => i.id === identifier.id)
                ? identifier.id
                : ""
            }
            onChange={(e) => {
              const i = c.identifiers.find((i) => i.id === e.target.value);
              if (i) setIdentifier(i);
            }}
          >
            <option value="">Custom input</option>
            {c.identifiers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.value} · {i.type}
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
        <button disabled={busy} className="primary full" onClick={launch}>
          <ArrowUpRight size={16} />
          {busy
            ? "Opening…"
            : `Open searches · ${selected.filter((id) => sources.some((s) => s.id === id)).length}`}
        </button>
        <p className="hint">
          Homepage launchers require manual entry. Use the copy button above.
        </p>
      </Section>
      <Section
        title="Research sources"
        description="Opening a source marks it searched, never verified."
      >
        <input
          placeholder="Find a source…"
          aria-label="Filter sources"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
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
          return (
            <details
              className="source-category"
              key={category}
              open={filter ? true : undefined}
            >
              <summary>
                <span>
                  {category}
                  <small>{categoryLabels[category]}</small>
                </span>
                <span className="count">
                  {checked} / {group.length}
                </span>
              </summary>
              <div className="source-list">
                {visible.map((source) => {
                  const item = c.checklist[source.id];
                  const supported = source.supportedIdentifiers.includes(
                    identifier.type,
                  );
                  return (
                    <div className="source-row" key={source.id}>
                      <div className="source-top">
                        <label className="check-label">
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
                          <strong>{source.name}</strong>
                        </label>
                        <span className="tag">
                          {source.strategy === "homepage"
                            ? "Manual"
                            : "Search URL"}
                        </span>
                      </div>
                      {!supported && (
                        <small>
                          Does not support {identifier.type} searches.
                        </small>
                      )}
                      <p className="hint">{source.notes}</p>
                      <select
                        aria-label={`${source.name} status`}
                        value={item?.status || "not_checked"}
                        onChange={(e) =>
                          void run(async () => {
                            const next = structuredClone(c);
                            next.checklist[source.id] = {
                              sourceId: source.id,
                              status: e.target
                                .value as (typeof statuses)[number],
                              notes: item?.notes || "",
                              updatedAt: now(),
                            };
                            activity(
                              next,
                              "source",
                              `${source.name}: ${human(e.target.value)}`,
                            );
                            await save(next);
                          })
                        }
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {s === "finding_found"
                              ? "Relevant Finding"
                              : human(s)}
                          </option>
                        ))}
                      </select>
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
                            activity(
                              next,
                              "note",
                              `${source.name} research note updated`,
                            );
                            await save(next);
                          });
                        }}
                      >
                        <input
                          aria-label={`${source.name} note`}
                          name="note"
                          placeholder="Source note…"
                          defaultValue={item?.notes}
                        />
                        <button>Save</button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </Section>
      <Section
        title="Query workbench"
        description="Select a query to edit it above, then open your chosen sources."
      >
        <div className="query-list">
          {buildQueries(c).map((q) => (
            <div key={q}>
              <code>{q}</code>
              <button
                className="icon"
                aria-label={`Use query ${q}`}
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
      </Section>
      <Section title="Case tabs">
        <div className="button-grid">
          {[
            ["focus", "Open Research Tabs"],
            ["group", "Group Current Tab"],
            ["ungroup", "Ungroup Tabs"],
            ["close", "Close Case Research Tabs"],
          ].map(([action, label]) => (
            <button
              key={action}
              onClick={() => {
                if (
                  action === "close" &&
                  !confirm("Close all tracked research tabs for this case?")
                )
                  return;
                void run(async () => {
                  await request({
                    kind: "tabs",
                    caseId: c.id,
                    action,
                    windowId,
                  });
                  notify(`${label}: completed.`);
                });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="hint">
          Ungrouping releases tab ownership. Tabs are tracked only for this
          browser session.
        </p>
      </Section>
    </>
  );
}
