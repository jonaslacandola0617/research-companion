import { useState } from "react";
import {
  activity,
  assessments,
  confidences,
  findingCategories,
  identifierTypes,
  now,
  uuid,
  type Finding,
} from "../../types";
import { useWorkspace } from "../workspace";
import { Empty, ExternalLink, Field, Modal, Section, human } from "../components/ui";

export function FindingsPage() {
  const { c, save, run, draft, dismissDraft, capture } = useWorkspace();
  const [editing, setEditing] = useState<Finding | null>(null);
  const [filter, setFilter] = useState("");
  const [assessment, setAssessment] = useState("All");

  if (!c) return null;

  const newFinding = (): Finding => {
    const capturedAt = draft?.mode === "finding" ? draft.capturedAt : now();
    const sourceUrl = draft?.mode === "finding" ? draft.sourceUrl : "";
    const pageTitle = draft?.mode === "finding" ? draft.pageTitle : "";
    const domain = draft?.mode === "finding" ? draft.domain : "";
    return {
      id: draft?.mode === "finding" ? draft.id : uuid(),
      caseId: c.id,
      title: "",
      text: draft?.mode === "finding" ? draft.text : "",
      sourceName: domain,
      sourceUrl,
      pageTitle,
      domain,
      identifierType: "other",
      relatedIdentifier: "",
      category: "Other",
      analystNote: "",
      assessment: "Requires Review",
      confidence: "Unrated",
      capturedAt,
      provenance: { sourceUrl, pageTitle, domain, capturedAt },
    };
  };

  const finding = editing || (draft?.mode === "finding" ? newFinding() : null);
  const close = () => {
    setEditing(null);
    if (draft?.mode === "finding") void run(dismissDraft);
  };

  const shown = c.findings.filter(
    (f) =>
      `${f.title} ${f.text} ${f.analystNote} ${f.sourceName}`
        .toLowerCase()
        .includes(filter.toLowerCase()) &&
      (assessment === "All" || f.assessment === assessment),
  );

  return (
    <>
      <div className="page-title compact-title findings-title">
        <span className="eyebrow">FINDINGS</span>
        <h1>Keep the context.</h1>
        <p>Save only what matters and keep the source attached.</p>
      </div>

      <div className="primary-action-row">
        <button className="primary full" onClick={() => void run(() => capture("finding"))}>
          Capture finding
        </button>
        <button className="text-button manual-finding-action" onClick={() => setEditing(newFinding())}>
          Add manually
        </button>
      </div>

      <Section
        title={`${c.findings.length} ${c.findings.length === 1 ? "finding" : "findings"}`}
        description="Newest findings appear first."
      >
        <div className="finding-filters">
          <input
            aria-label="Search findings"
            placeholder="Search findings…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <select
            aria-label="Filter findings by assessment"
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
          >
            {["All", ...assessments].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>

        {!c.findings.length ? (
          <Empty
            title="No findings yet"
            action={
              <button className="primary" onClick={() => void run(() => capture("finding"))}>
                Capture finding
              </button>
            }
          >
            Highlight relevant information while researching, or capture the current page and add an observation.
          </Empty>
        ) : !shown.length ? (
          <p className="hint">No findings match these filters.</p>
        ) : (
          <div className="finding-thread">
            {shown
              .slice()
              .reverse()
              .map((f) => (
                <article className="finding notebook-finding" key={f.id}>
                  <span className="finding-thread-dot" aria-hidden="true" />
                  <div className="finding-meta">
                    <span>{f.category}</span>
                    <time>
                      {new Date(f.capturedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                      {" · "}
                      {new Date(f.capturedAt).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <h3>{f.title}</h3>
                  {f.text && <blockquote>{f.text}</blockquote>}
                  <p className="finding-state-line">
                    <span className={f.assessment === "Conflicting" ? "state-conflict" : ""}>
                      {f.assessment}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{f.confidence} confidence</span>
                  </p>
                  {f.analystNote && <p className="preserve analyst-note">{f.analystNote}</p>}
                  <div className="finding-footer">
                    <ExternalLink url={f.sourceUrl}>
                      {f.sourceName || f.domain || "Manual entry"}
                    </ExternalLink>
                    <button className="text-button" onClick={() => setEditing(f)}>
                      Review
                    </button>
                  </div>
                </article>
              ))}
          </div>
        )}
      </Section>

      {finding && (
        <FindingEditor
          key={finding.id}
          finding={finding}
          close={close}
          onSave={async (f) => {
            const next = structuredClone(c);
            const index = next.findings.findIndex((x) => x.id === f.id);
            if (index >= 0) next.findings[index] = f;
            else next.findings.push(f);
            activity(next, "finding", `${index >= 0 ? "Updated" : "Captured"} finding: ${f.title}`);
            await save(next);
            close();
          }}
          onDelete={
            editing && c.findings.some((f) => f.id === editing.id)
              ? async () => {
                  if (!confirm("Delete this finding?")) return;
                  const next = structuredClone(c);
                  next.findings = next.findings.filter((f) => f.id !== editing.id);
                  activity(next, "finding", `Deleted finding: ${editing.title}`);
                  await save(next);
                  close();
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function FindingEditor({
  finding,
  close,
  onSave,
  onDelete,
}: {
  finding: Finding;
  close: () => void;
  onSave: (f: Finding) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const { run, c } = useWorkspace();
  const [f, setF] = useState(finding);
  const update = (key: keyof Finding, v: string) => setF({ ...f, [key]: v });

  return (
    <Modal title={onDelete ? "Review finding" : "Capture finding"} close={close}>
      <form
        className="finding-editor"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const next = { ...f, title: f.title.trim() };
            if (!next.provenance.sourceUrl && next.sourceUrl && !onDelete) {
              next.provenance = {
                sourceUrl: next.sourceUrl,
                pageTitle: next.pageTitle,
                domain: new URL(next.sourceUrl).hostname,
                capturedAt: next.capturedAt,
              };
              next.domain = next.provenance.domain;
            }
            await onSave(next);
          });
        }}
      >
        {f.text && (
          <div className="captured-observation">
            <span className="eyebrow">CAPTURED TEXT</span>
            <blockquote>{f.text}</blockquote>
          </div>
        )}

        <Field label="Finding title">
          <input
            required
            autoFocus
            placeholder="What did you learn?"
            value={f.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </Field>

        <Field label={f.text ? "Observation" : "Selected text / observation"}>
          <textarea
            rows={4}
            value={f.text}
            onChange={(e) => update("text", e.target.value)}
            placeholder="Record the relevant information."
          />
        </Field>

        <div className="form-grid finding-core-fields">
          <Field label="Category">
            <select value={f.category} onChange={(e) => update("category", e.target.value)}>
              {findingCategories.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Assessment">
            <select value={f.assessment} onChange={(e) => update("assessment", e.target.value)}>
              {assessments.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Confidence">
            <select value={f.confidence} onChange={(e) => update("confidence", e.target.value)}>
              {confidences.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Analyst note">
          <textarea
            value={f.analystNote}
            onChange={(e) => update("analystNote", e.target.value)}
            placeholder="Optional context, reasoning, or follow-up."
          />
        </Field>

        <details className="quiet-disclosure editor-disclosure">
          <summary>Link to an identifier</summary>
          <div className="form-grid">
            <Field label="Identifier type">
              <select value={f.identifierType} onChange={(e) => update("identifierType", e.target.value)}>
                {identifierTypes.map((v) => (
                  <option key={v} value={v}>
                    {human(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Related identifier">
              <input
                list="finding-identifiers"
                value={f.relatedIdentifier}
                onChange={(e) => update("relatedIdentifier", e.target.value)}
              />
              <datalist id="finding-identifiers">
                {c?.identifiers.map((i) => (
                  <option key={i.id} value={i.value} />
                ))}
              </datalist>
            </Field>
          </div>
        </details>

        <details className="quiet-disclosure editor-disclosure source-details-editor">
          <summary>Source details</summary>
          <Field label="Source name">
            <input value={f.sourceName} onChange={(e) => update("sourceName", e.target.value)} />
          </Field>
          <Field label="Source URL">
            <input type="url" value={f.sourceUrl} onChange={(e) => update("sourceUrl", e.target.value)} />
          </Field>
          <Field label="Page title">
            <input value={f.pageTitle} onChange={(e) => update("pageTitle", e.target.value)} />
          </Field>
          <div className="provenance retained-provenance">
            <span className="eyebrow">ORIGINAL PROVENANCE · RETAINED</span>
            <p>{f.provenance.pageTitle || "Manual entry"}</p>
            <p className="break">{f.provenance.sourceUrl || "No page URL captured"}</p>
            {f.provenance.domain && <p>{f.provenance.domain}</p>}
            <time>{new Date(f.provenance.capturedAt).toLocaleString()}</time>
          </div>
        </details>

        <div className="form-actions finding-save-actions">
          <button className="primary">Save finding</button>
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
