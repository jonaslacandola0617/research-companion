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
  return (
    <>
      <div className="page-title">
        <span className="eyebrow">COMPARE & CORROBORATE</span>
        <h1>Weigh the evidence.</h1>
        <p>Record similarities, conflicts, and your assessment.</p>
      </div>
      <div className="notice">
        Every match and classification is selected by the analyst. No identity
        is determined automatically.
      </div>
      <Section
        title={`Candidate identities · ${c.candidates.length}`}
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
            Add
          </AddButton>
        }
      >
        {!c.candidates.length ? (
          <Empty title="Keep possibilities separate.">
            Add a candidate to compare their identifiers with the subject.
          </Empty>
        ) : (
          c.candidates.map((candidate, index) => (
            <article className="candidate" key={candidate.id}>
              <div className="candidate-header">
                <span className="candidate-letter">
                  {String.fromCharCode(65 + index)}
                </span>
                <div>
                  <h3>{candidate.name}</h3>
                  <span className="tag">{candidate.classification}</span>
                </div>
                <button
                  className="text-button"
                  onClick={() => setCandidate(candidate)}
                >
                  Edit
                </button>
              </div>
              <div className="candidate-values">
                {candidate.identifiers.map((i) => (
                  <p key={i.id}>
                    <span>{human(i.type)}</span>
                    {i.value}
                  </p>
                ))}
              </div>
              {candidate.rationale && (
                <p className="hint preserve">{candidate.rationale}</p>
              )}
            </article>
          ))
        )}
      </Section>
      <Section
        title="Identifier match matrix"
        description="Each cell is a manual assessment. Scroll horizontally to compare candidates."
      >
        {c.candidates.length && c.identifiers.length ? (
          <div
            className="matrix-scroll"
            tabIndex={0}
            role="region"
            aria-label="Scrollable identifier comparison matrix"
          >
            <table>
              <thead>
                <tr>
                  <th>Identifier / subject</th>
                  {c.candidates.map((candidate) => (
                    <th key={candidate.id}>{candidate.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows(c).map((row) => (
                  <tr key={row.identifier.id}>
                    <th>
                      <small>{human(row.identifier.type)}</small>
                      <strong>{row.identifier.value}</strong>
                    </th>
                    {row.cells.map((cell) => (
                      <td
                        key={cell.candidateId}
                        className={
                          "cell-" +
                          cell.status.toLowerCase().replaceAll(" ", "-")
                        }
                      >
                        <select
                          aria-label={`${row.identifier.value} against ${c.candidates.find((c) => c.id === cell.candidateId)?.name}`}
                          value={cell.status}
                          onChange={(e) =>
                            void run(async () => {
                              const next = structuredClone(c);
                              const index = next.candidates.findIndex(
                                (x) => x.id === cell.candidateId,
                              );
                              next.candidates[index] = setComparison(
                                next.candidates[index],
                                row.identifier.id,
                                e.target.value as (typeof matches)[number],
                                cell.note,
                              );
                              activity(
                                next,
                                "candidate",
                                `${next.candidates[index].name}: ${row.identifier.value} — ${e.target.value}`,
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
                        <form
                          className="cell-note"
                          key={cell.note}
                          onSubmit={(e) => {
                            e.preventDefault();
                            const note = String(
                              new FormData(e.currentTarget).get("note"),
                            );
                            void run(async () => {
                              const next = structuredClone(c);
                              const index = next.candidates.findIndex(
                                (x) => x.id === cell.candidateId,
                              );
                              next.candidates[index] = setComparison(
                                next.candidates[index],
                                row.identifier.id,
                                cell.status,
                                note,
                              );
                              activity(
                                next,
                                "note",
                                `Comparison note updated: ${next.candidates[index].name}, ${row.identifier.value}`,
                              );
                              await save(next);
                            });
                          }}
                        >
                          <input
                            name="note"
                            aria-label={`Comparison note for ${row.identifier.value}, ${c.candidates.find((c) => c.id === cell.candidateId)?.name}`}
                            defaultValue={cell.note}
                            placeholder="Evidence / context"
                          />
                          <button>Save</button>
                        </form>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hint">
            Add subject identifiers and at least one candidate to build the
            matrix.
          </p>
        )}
      </Section>
      <Section
        title="Discrepancies"
        description="Conflicting information stays visible until you resolve it."
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
            Add
          </AddButton>
        }
      >
        {!c.discrepancies.length && (
          <p className="hint">No discrepancies recorded.</p>
        )}
        {c.discrepancies.map((d) => (
          <article className="finding" key={d.id}>
            <div className="finding-meta">
              <span>≠ DISCREPANCY</span>
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
            <p>{d.explanation}</p>
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
                  if (
                    !confirm(
                      "Delete this candidate and their comparison cells?",
                    )
                  )
                    return;
                  const next = structuredClone(c);
                  next.candidates = next.candidates.filter(
                    (x) => x.id !== candidate.id,
                  );
                  activity(
                    next,
                    "candidate",
                    `Candidate removed: ${candidate.name}`,
                  );
                  await save(next);
                  setCandidate(null);
                }
              : undefined
          }
        />
      )}{" "}
      {discrepancy && (
        <Modal title="Review discrepancy" close={() => setDiscrepancy(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const next = structuredClone(c);
                const index = next.discrepancies.findIndex(
                  (x) => x.id === discrepancy.id,
                );
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
            onChange={(e) =>
              setCandidate({ ...candidate, name: e.target.value })
            }
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
            onChange={(e) =>
              setCandidate({ ...candidate, rationale: e.target.value })
            }
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
                  identifiers: candidate.identifiers.filter(
                    (x) => x.id !== i.id,
                  ),
                })
              }
            >
              ×
            </button>
          </div>
        ))}
        <div className="form-grid">
          <Field label="Identifier type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as IdentifierType)}
            >
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
            <button
              type="button"
              className="danger"
              onClick={() => void run(onDelete)}
            >
              Delete
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
