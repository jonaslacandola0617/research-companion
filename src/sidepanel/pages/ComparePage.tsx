import { useState } from "react";
import {
  activity,
  classifications,
  identifierTypes,
  makeIdentifier,
  matches,
  uuid,
  type Candidate,
  type Discrepancy,
  type IdentifierType,
} from "../../types";
import { useWorkspace } from "../workspace";
import {
  AddButton,
  Empty,
  Field,
  Modal,
  Section,
  human,
} from "../components/ui";
import { comparisonRows, setComparison } from "../../services/comparison";

export function ComparePage() {
  const { c, save, run } = useWorkspace();
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [discrepancy, setDiscrepancy] = useState<Discrepancy | null>(null);
  if (!c) return null;

  const rows = comparisonRows(c);

  return (
    <>
      <div className="page-title">
        <span className="eyebrow">COMPARE</span>
        <h1>Keep candidates separate.</h1>
        <p>Compare one identity at a time, record conflicts, and keep the final judgment human.</p>
      </div>

      <div className="notice">
        Match states and classifications are analyst-selected. Research Companion does not determine identity automatically.
      </div>

      <Section
        title={`Candidate identities · ${c.candidates.length}`}
        description="Treat each possible identity as its own working hypothesis."
        action={
          <AddButton
            onClick={() =>
              setCandidate({
                id: uuid(),
                name: "",
                identifiers: [],
                classification: "Unreviewed",
                rationale: "",
                comparisons: {},
              })
            }
          >
            Add candidate
          </AddButton>
        }
      >
        {!c.candidates.length ? (
          <Empty title="No candidates yet">
            Add a candidate when you need to compare a possible identity with the subject.
          </Empty>
        ) : (
          c.candidates.map((item, index) => (
            <article className="candidate" key={item.id}>
              <div className="candidate-header">
                <span className="candidate-letter" aria-hidden="true">
                  {String.fromCharCode(65 + index)}
                </span>
                <div>
                  <h3>{item.name}</h3>
                  <span className="tag">{item.classification}</span>
                </div>
                <button className="text-button" onClick={() => setCandidate(item)}>
                  Review
                </button>
              </div>
              {!!item.identifiers.length && (
                <div className="candidate-values">
                  {item.identifiers.map((i) => (
                    <p key={i.id}>
                      <span>{human(i.type)}</span>
                      {i.value}
                    </p>
                  ))}
                </div>
              )}
              {item.rationale && <p className="hint preserve">{item.rationale}</p>}
            </article>
          ))
        )}
      </Section>

      <Section
        title="Compare identifiers"
        description="Open a candidate and assess the subject identifiers vertically—no squeezed spreadsheet."
      >
        {c.candidates.length && c.identifiers.length ? (
          c.candidates.map((item) => (
            <details className="comparison-candidate" key={item.id}>
              <summary>
                <strong>{item.name}</strong>
                <span className="tag">{item.classification}</span>
              </summary>
              <div className="comparison-list">
                {rows.map((row) => {
                  const cell = row.cells.find((x) => x.candidateId === item.id);
                  if (!cell) return null;
                  const stateClass = cell.status.toLowerCase().replaceAll(" ", "-");
                  return (
                    <div
                      className={`comparison-row cell-${stateClass}`}
                      key={`${item.id}-${row.identifier.id}`}
                    >
                      <div className="comparison-subject">
                        <small>{human(row.identifier.type)}</small>
                        <strong>{row.identifier.value}</strong>
                      </div>
                      <label className="comparison-status">
                        <span>Assessment</span>
                        <select
                          aria-label={`${row.identifier.value} against ${item.name}`}
                          value={cell.status}
                          onChange={(e) =>
                            void run(async () => {
                              const next = structuredClone(c);
                              const index = next.candidates.findIndex((x) => x.id === item.id);
                              next.candidates[index] = setComparison(
                                next.candidates[index],
                                row.identifier.id,
                                e.target.value as (typeof matches)[number],
                                cell.note,
                              );
                              activity(
                                next,
                                "candidate",
                                `${item.name}: ${row.identifier.value} — ${e.target.value}`,
                              );
                              await save(next);
                            })
                          }
                        >
                          {matches.map((m, index) => (
                            <option key={m} value={m}>
                              {["✓", "≈", "≠", "?", "—"][index]} {m}
                            </option>
                          ))}
                        </select>
                      </label>
                      <form
                        className="comparison-note"
                        key={cell.note}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const note = String(new FormData(e.currentTarget).get("note"));
                          void run(async () => {
                            const next = structuredClone(c);
                            const index = next.candidates.findIndex((x) => x.id === item.id);
                            next.candidates[index] = setComparison(
                              next.candidates[index],
                              row.identifier.id,
                              cell.status,
                              note,
                            );
                            activity(
                              next,
                              "note",
                              `Comparison note updated: ${item.name}, ${row.identifier.value}`,
                            );
                            await save(next);
                          });
                        }}
                      >
                        <input
                          name="note"
                          aria-label={`Comparison note for ${row.identifier.value}, ${item.name}`}
                          defaultValue={cell.note}
                          placeholder="Evidence or context…"
                        />
                        <button>Save</button>
                      </form>
                    </div>
                  );
                })}
              </div>
            </details>
          ))
        ) : (
          <p className="hint">
            Add subject identifiers and at least one candidate to start comparing.
          </p>
        )}
      </Section>

      <Section
        title="Discrepancies"
        description="Keep conflicting information visible until you resolve it."
        action={
          <AddButton
            onClick={() =>
              setDiscrepancy({
                id: uuid(),
                title: "",
                sourceA: "",
                valueA: "",
                sourceB: "",
                valueB: "",
                explanation: "",
                notes: "",
                status: "Unresolved",
              })
            }
          >
            Add discrepancy
          </AddButton>
        }
      >
        {!c.discrepancies.length && <p className="hint">No discrepancies recorded.</p>}
        {c.discrepancies.map((d) => (
          <article className="finding" key={d.id}>
            <div className="finding-meta">
              <span>DISCREPANCY</span>
              <span>{d.status}</span>
            </div>
            <h3>{d.title}</h3>
            <div className="discrepancy-values">
              <p>
                <span>{d.sourceA || "Source A"}</span>
                {d.valueA}
              </p>
              <p>
                <span>{d.sourceB || "Source B"}</span>
                {d.valueB}
              </p>
            </div>
            {d.explanation && <p>{d.explanation}</p>}
            {d.notes && <p className="preserve">{d.notes}</p>}
            <button className="text-button" onClick={() => setDiscrepancy(d)}>
              Review / resolve
            </button>
          </article>
        ))}
      </Section>

      {candidate && (
        <CandidateEditor
          key={candidate.id}
          initial={candidate}
          close={() => setCandidate(null)}
          onSave={async (value) => {
            const next = structuredClone(c);
            const index = next.candidates.findIndex((x) => x.id === value.id);
            if (index >= 0) next.candidates[index] = value;
            else next.candidates.push(value);
            activity(
              next,
              "candidate",
              `${value.name}: ${value.classification}; ${value.rationale || "No rationale provided"}`,
            );
            await save(next);
            setCandidate(null);
          }}
          onDelete={
            c.candidates.some((x) => x.id === candidate.id)
              ? async () => {
                  if (!confirm("Delete this candidate and their comparison cells?")) return;
                  const next = structuredClone(c);
                  next.candidates = next.candidates.filter((x) => x.id !== candidate.id);
                  activity(next, "candidate", `Candidate removed: ${candidate.name}`);
                  await save(next);
                  setCandidate(null);
                }
              : undefined
          }
        />
      )}

      {discrepancy && (
        <Modal title="Review discrepancy" close={() => setDiscrepancy(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const next = structuredClone(c);
                const index = next.discrepancies.findIndex((x) => x.id === discrepancy.id);
                if (index >= 0) next.discrepancies[index] = discrepancy;
                else next.discrepancies.push(discrepancy);
                activity(
                  next,
                  "discrepancy",
                  `${discrepancy.title}: ${discrepancy.status}`,
                );
                await save(next);
                setDiscrepancy(null);
              });
            }}
          >
            {(
              [
                "title",
                "sourceA",
                "valueA",
                "sourceB",
                "valueB",
                "explanation",
                "notes",
              ] as const
            ).map((key) => (
              <Field key={key} label={human(key.replace(/([A-Z])/g, " $1"))}>
                {["notes", "explanation"].includes(key) ? (
                  <textarea
                    value={discrepancy[key]}
                    onChange={(e) =>
                      setDiscrepancy({ ...discrepancy, [key]: e.target.value })
                    }
                  />
                ) : (
                  <input
                    required={key === "title"}
                    value={discrepancy[key]}
                    onChange={(e) =>
                      setDiscrepancy({ ...discrepancy, [key]: e.target.value })
                    }
                  />
                )}
              </Field>
            ))}
            <Field label="Status">
              <select
                value={discrepancy.status}
                onChange={(e) =>
                  setDiscrepancy({
                    ...discrepancy,
                    status: e.target.value as Discrepancy["status"],
                  })
                }
              >
                <option>Unresolved</option>
                <option>Resolved</option>
              </select>
            </Field>
            <button className="primary">Save discrepancy</button>
          </form>
        </Modal>
      )}
    </>
  );
}

function CandidateEditor({
  initial,
  close,
  onSave,
  onDelete,
}: {
  initial: Candidate;
  close: () => void;
  onSave: (c: Candidate) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { run } = useWorkspace();
  const [candidate, setCandidate] = useState(initial);
  const [type, setType] = useState<IdentifierType>("name");
  const [value, setValue] = useState("");

  return (
    <Modal title="Candidate profile" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(() => onSave({ ...candidate, name: candidate.name.trim() }));
        }}
      >
        <Field label="Candidate name">
          <input
            required
            autoFocus
            value={candidate.name}
            onChange={(e) => setCandidate({ ...candidate, name: e.target.value })}
          />
        </Field>
        <Field label="Analyst classification">
          <select
            value={candidate.classification}
            onChange={(e) =>
              setCandidate({
                ...candidate,
                classification: e.target.value as Candidate["classification"],
              })
            }
          >
            {classifications.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Assessment rationale">
          <textarea
            value={candidate.rationale}
            onChange={(e) => setCandidate({ ...candidate, rationale: e.target.value })}
          />
        </Field>

        <h3>Discovered identifiers</h3>
        {candidate.identifiers.map((i) => (
          <div className="candidate-identifier" key={i.id}>
            <span>{human(i.type)}</span>
            <input
              aria-label={`Candidate ${i.type}`}
              value={i.value}
              onChange={(e) =>
                setCandidate({
                  ...candidate,
                  identifiers: candidate.identifiers.map((x) =>
                    x.id === i.id ? { ...x, value: e.target.value } : x,
                  ),
                })
              }
            />
            <button
              type="button"
              aria-label={`Remove ${i.value}`}
              onClick={() =>
                setCandidate({
                  ...candidate,
                  identifiers: candidate.identifiers.filter((x) => x.id !== i.id),
                })
              }
            >
              ×
            </button>
          </div>
        ))}

        <div className="form-grid">
          <Field label="Identifier type">
            <select value={type} onChange={(e) => setType(e.target.value as IdentifierType)}>
              {identifierTypes.map((t) => (
                <option key={t} value={t}>
                  {human(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Identifier value">
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </div>

        <button
          type="button"
          disabled={!value.trim()}
          onClick={() => {
            setCandidate({
              ...candidate,
              identifiers: [
                ...candidate.identifiers,
                makeIdentifier(type, value.trim()),
              ],
            });
            setValue("");
          }}
        >
          Add to candidate
        </button>

        <div className="form-actions">
          <button className="primary">Save candidate</button>
          {onDelete && (
            <button type="button" className="danger" onClick={() => void run(onDelete)}>
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
