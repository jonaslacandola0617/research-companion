import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import {
  categories,
  identifierTypes,
  uuid,
  type ResearchSource,
} from "../../types";
import { useWorkspace } from "../workspace";
import {
  download,
  importCase,
  serializeCase,
} from "../../services/exportImport";
import { mutate } from "../../services/storage";
import { createDemoCase } from "../../config/demo";
import {
  validateTemplate,
  templateVariables,
} from "../../services/queryBuilder";
import { Field, Modal, Section, ExternalLink } from "../components/ui";
export function SettingsPage() {
  const { state, c, run, refresh, notify } = useWorkspace();
  const [editing, setEditing] = useState<ResearchSource | null>(null);
  const [filter, setFilter] = useState("");
  const saveSources = async (sources: ResearchSource[]) => {
    await mutate({
      type: "settings",
      expected: JSON.stringify(state.settings),
      settings: { ...state.settings, sources },
    });
    await refresh();
  };
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">WORKSPACE SETTINGS</span>
        <h1>Make it your workspace.</h1>
        <p>Local preferences, portable cases, and research sources.</p>
      </div>
      <Section title="Appearance">
        <Field label="Theme">
          <select
            value={state.settings.theme}
            onChange={(e) =>
              void run(async () => {
                await mutate({
                  type: "settings",
                  expected: JSON.stringify(state.settings),
                  settings: {
                    ...state.settings,
                    theme: e.target.value as "light" | "dark",
                  },
                });
                await refresh();
              })
            }
          >
            <option value="light">Light · Neutral</option>
            <option value="dark">Dark · Neutral</option>
          </select>
        </Field>
      </Section>
      <Section title="Deep Search defaults" description="Controls plan size and conservative batch execution.">
        <div className="form-grid">
          <Field label="Search depth">
            <select
              value={state.settings.deepSearch.defaultTaskLimit}
              onChange={(e) => void run(async () => {
                await mutate({
                  type: "settings",
                  expected: JSON.stringify(state.settings),
                  settings: {
                    ...state.settings,
                    deepSearch: { ...state.settings.deepSearch, defaultTaskLimit: Number(e.target.value) as 12 | 24 | 36 | 48 | 60 },
                  },
                });
                await refresh();
              })}
            >
              <option value={12}>Quick · 12</option>
              <option value={24}>Focused · 24</option>
              <option value={36}>Standard · 36</option>
              <option value={48}>Broad · 48</option>
              <option value={60}>Extensive · 60</option>
            </select>
          </Field>
          <Field label="Batch size">
            <select
              value={state.settings.deepSearch.batchSize}
              onChange={(e) => void run(async () => {
                await mutate({
                  type: "settings",
                  expected: JSON.stringify(state.settings),
                  settings: {
                    ...state.settings,
                    deepSearch: { ...state.settings.deepSearch, batchSize: Number(e.target.value) as 3 | 5 | 8 | 10 },
                  },
                });
                await refresh();
              })}
            >
              {[3, 5, 8, 10].map((value) => <option key={value} value={value}>{value} tabs</option>)}
            </select>
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={state.settings.deepSearch.includePublicRecords}
            onChange={(e) => void run(async () => {
              await mutate({
                type: "settings",
                expected: JSON.stringify(state.settings),
                settings: {
                  ...state.settings,
                  deepSearch: { ...state.settings.deepSearch, includePublicRecords: e.target.checked },
                },
              });
              await refresh();
            })}
          />
          Include public-record sources by default
        </label>
        <fieldset>
          <legend>Preferred search engines</legend>
          <div className="button-grid">
            {(["google", "bing", "duckduckgo"] as const).map((engine) => (
              <label className="check-label" key={engine}>
                <input
                  type="checkbox"
                  checked={state.settings.deepSearch.preferredEngines.includes(engine)}
                  onChange={(e) => void run(async () => {
                    const preferredEngines = e.target.checked
                      ? [...state.settings.deepSearch.preferredEngines, engine]
                      : state.settings.deepSearch.preferredEngines.filter((item) => item !== engine);
                    if (!preferredEngines.length) throw Error("Keep at least one search engine enabled.");
                    await mutate({
                      type: "settings",
                      expected: JSON.stringify(state.settings),
                      settings: {
                        ...state.settings,
                        deepSearch: { ...state.settings.deepSearch, preferredEngines },
                      },
                    });
                    await refresh();
                  })}
                />
                {engine === "duckduckgo" ? "DuckDuckGo" : engine[0].toUpperCase() + engine.slice(1)}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>
      <Section
        title="Case portability"
        description="Export files contain unencrypted case data. Keep backups in a location you control."
      >
        <div className="button-grid">
          <button
            disabled={!c}
            onClick={() =>
              c && download("research-case.json", serializeCase(c))
            }
          >
            Export current case
          </button>
          <label className="button">
            Import case JSON
            <input
              className="sr-only"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(async () => {
                    if (file.size > 10_000_000)
                      throw Error("The imported file exceeds 10 MB.");
                    await mutate({
                      type: "import",
                      data: importCase(await file.text()),
                    });
                    await refresh();
                    notify(
                      "Case imported. Original case ID and provenance retained.",
                    );
                  });
              }}
            />
          </label>
        </div>
        <p className="hint">Imports never overwrite an existing case ID.</p>
      </Section>
      <Section
        title="Explore a fictional case"
        description="Includes sample identifiers, three candidates, findings, and a discrepancy."
      >
        <button
          onClick={() =>
            void run(async () => {
              await mutate({ type: "import", data: createDemoCase() });
              await refresh();
              notify("FICTIONAL DEMO DATA loaded.");
            })
          }
        >
          Load fictional demo
        </button>
      </Section>
      <Section
        title={`Source manager · ${state.settings.sources.length}`}
        action={
          <button
            className="subtle"
            onClick={() =>
              setEditing({
                id: "custom-" + uuid(),
                name: "",
                category: "SEARCH",
                homepage: "",
                strategy: "homepage",
                template: "",
                interaction: "manual",
                directTemplate: "",
                priority: 50,
                requiresLogin: false,
                potentiallyBlocked: false,
                supportedIdentifiers: [...identifierTypes],
                enabled: true,
                notes:
                  "Custom source. Enter search input manually when using homepage mode.",
              })
            }
          >
            Add custom
          </button>
        }
      >
        <Field label="Filter sources">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Source name or category…"
          />
        </Field>
        {state.settings.sources
          .map((s, index) => ({ s, index }))
          .filter(({ s }) =>
            `${s.name} ${s.category}`
              .toLowerCase()
              .includes(filter.toLowerCase()),
          )
          .map(({ s, index }) => (
            <div className="settings-source" key={s.id}>
              <div className="source-top">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) =>
                      void run(() =>
                        saveSources(
                          state.settings.sources.map((x) =>
                            x.id === s.id
                              ? { ...x, enabled: e.target.checked }
                              : x,
                          ),
                        ),
                      )
                    }
                  />
                  <strong>{s.name}</strong>
                </label>
                <span className="tag">{s.category}</span>
              </div>
              <div className="settings-source-actions">
                <ExternalLink url={s.homepage}>Homepage</ExternalLink>
                <button className="text-button" onClick={() => setEditing(s)}>
                  Edit
                </button>
                <button
                  className="icon"
                  aria-label={`Move ${s.name} up`}
                  disabled={index === 0}
                  onClick={() =>
                    void run(async () => {
                      const sources = [...state.settings.sources];
                      [sources[index - 1], sources[index]] = [
                        sources[index],
                        sources[index - 1],
                      ];
                      await saveSources(sources);
                    })
                  }
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon"
                  aria-label={`Move ${s.name} down`}
                  disabled={index === state.settings.sources.length - 1}
                  onClick={() =>
                    void run(async () => {
                      const sources = [...state.settings.sources];
                      [sources[index + 1], sources[index]] = [
                        sources[index],
                        sources[index + 1],
                      ];
                      await saveSources(sources);
                    })
                  }
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          ))}
      </Section>
      <Section title="Privacy & storage">
        <p className="hint">
          No backend, account, analytics, telemetry, or external AI. Identifiers
          leave the browser only when you deliberately open search URLs.
          Third-party websites then apply their own privacy policies. Local
          storage is not encrypted.
        </p>
        <p className="hint">
          Chrome shortcuts: Alt+Shift+R opens the panel, Alt+Shift+F captures
          selected text, and Alt+Shift+I adds a selected identifier. Customize
          them at chrome://extensions/shortcuts.
        </p>
      </Section>
      {editing && (
        <Modal title="Configure research source" close={() => setEditing(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                validateTemplate(editing.template);
                validateTemplate(editing.directTemplate);
                if (editing.strategy === "template" && !editing.template)
                  throw Error("Enter a search URL template.");
                if (editing.interaction === "direct" && !editing.directTemplate)
                  throw Error("A direct source needs a search URL template.");
                if (!editing.supportedIdentifiers.length)
                  throw Error("Select at least one supported identifier type.");
                const sources = [...state.settings.sources];
                const index = sources.findIndex((s) => s.id === editing.id);
                if (index >= 0) sources[index] = editing;
                else sources.push(editing);
                await saveSources(sources);
                setEditing(null);
              });
            }}
          >
            <Field label="Name">
              <input
                required
                autoFocus
                value={editing.name}
                onChange={(e) =>
                  setEditing({ ...editing, name: e.target.value })
                }
              />
            </Field>
            <Field label="Category">
              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    category: e.target.value as ResearchSource["category"],
                  })
                }
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Homepage">
              <input
                type="url"
                required
                value={editing.homepage}
                onChange={(e) =>
                  setEditing({ ...editing, homepage: e.target.value })
                }
              />
            </Field>
            <Field label="Search strategy">
              <select
                value={editing.strategy}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    strategy: e.target.value as ResearchSource["strategy"],
                  })
                }
              >
                <option value="homepage">Open homepage · manual search</option>
                <option value="template">Search URL template</option>
              </select>
            </Field>
            <Field label="Deep Search interaction">
              <select
                value={editing.interaction}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    interaction: e.target.value as ResearchSource["interaction"],
                  })
                }
              >
                <option value="manual">Open homepage · analyst enters values</option>
                <option value="search-engine-site-query">Search-engine site discovery</option>
                <option value="direct">Reliable direct URL template</option>
              </select>
            </Field>
            <Field
              label="Search URL template"
              hint={templateVariables.map((v) => `{${v}}`).join(" ")}
            >
              <input
                placeholder="https://example.com/search?q={query}"
                value={editing.template}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    template: e.target.value,
                    directTemplate: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="Planner priority" hint="Lower numbers are scheduled earlier.">
              <input
                type="number"
                min={1}
                max={100}
                value={editing.priority}
                onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) })}
              />
            </Field>
            <div className="button-grid">
              <label className="check-label">
                <input type="checkbox" checked={editing.requiresLogin} onChange={(e) => setEditing({ ...editing, requiresLogin: e.target.checked })} />
                May require login
              </label>
              <label className="check-label">
                <input type="checkbox" checked={editing.potentiallyBlocked} onChange={(e) => setEditing({ ...editing, potentiallyBlocked: e.target.checked })} />
                May block automation
              </label>
            </div>
            <fieldset>
              <legend>Supported identifiers</legend>
              <div className="button-grid">
                {identifierTypes.map((t) => (
                  <label className="check-label" key={t}>
                    <input
                      type="checkbox"
                      checked={editing.supportedIdentifiers.includes(t)}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          supportedIdentifiers: e.target.checked
                            ? [...editing.supportedIdentifiers, t]
                            : editing.supportedIdentifiers.filter(
                                (x) => x !== t,
                              ),
                        })
                      }
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Notes">
              <textarea
                value={editing.notes}
                onChange={(e) =>
                  setEditing({ ...editing, notes: e.target.value })
                }
              />
            </Field>
            <button className="primary">Save source</button>
          </form>
        </Modal>
      )}
    </>
  );
}
