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
import {
  AddButton,
  Empty,
  ExternalLink,
  Field,
  Modal,
  Section,
  human,
} from "../components/ui";
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
      <div className="page-title">
        <span className="eyebrow">EVIDENCE LIBRARY</span>
        <h1>Keep the context.</h1>
        <p>Capture observations. Preserve where they came from.</p>
      </div>
      <div className="button-grid">
        <button
          className="primary"
          onClick={() => void run(() => capture("finding"))}
        >
          Capture current page
        </button>
        <button onClick={() => setEditing(newFinding())}>
          Add manual finding
        </button>
      </div>
      <Section title={`Findings · ${c.findings.length}`}>
        <Field label="Search findings">
          <input
            placeholder="Title, text, source, or notes…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </Field>
        <Field label="Assessment">
          <select
            value={assessment}
            onChange={(e) => setAssessment(e.target.value)}
          >
            {["All", ...assessments].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        {!c.findings.length ? (
          <Empty title="No findings yet">
            Capture relevant information from research pages or add a manual
            finding.
          </Empty>
        ) : !shown.length ? (
          <p className="hint">No findings match these filters.</p>
        ) : (
          shown
            .slice()
            .reverse()
            .map((f) => (
              <article className="finding" key={f.id}>
                <div className="finding-meta">
                  <span>{f.category}</span>
                  <time>{new Date(f.capturedAt).toLocaleDateString()}</time>
                </div>
                <h3>{f.title}</h3>
                <blockquote>{f.text}</blockquote>
                <div className="tags">
                  <span
                    className={
                      "tag " +
                      (f.assessment === "Conflicting"
                        ? "conflict"
                        : f.assessment === "Supporting"
                          ? "support"
                          : "")
                    }
                  >
                    {f.assessment}
                  </span>
                  <span className="tag">{f.confidence} confidence</span>
                </div>
                {f.analystNote && <p className="preserve">{f.analystNote}</p>}
                <div className="finding-footer">
                  <ExternalLink url={f.sourceUrl}>
                    {f.sourceName || f.domain || "Manual entry"}
                  </ExternalLink>
                  <button className="text-button" onClick={() => setEditing(f)}>
                    Review / edit
                  </button>
                </div>
              </article>
            ))
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
            activity(
              next,
              "finding",
              `${index >= 0 ? "Updated" : "Captured"} finding: ${f.title}`,
            );
            await save(next);
            close();
          }}
          onDelete={
            editing && c.findings.some((f) => f.id === editing.id)
              ? async () => {
                  if (!confirm("Delete this finding?")) return;
                  const next = structuredClone(c);
                  next.findings = next.findings.filter(
                    (f) => f.id !== editing.id,
                  );
                  activity(
                    next,
                    "finding",
                    `Deleted finding: ${editing.title}`,
                  );
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
    <Modal title="Review finding" close={close}>
      <form
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
        <Field label="Title">
          <input
            required
            autoFocus
            value={f.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </Field>
        <Field label="Selected text / observation">
          <textarea
            rows={5}
            value={f.text}
            onChange={(e) => update("text", e.target.value)}
          />
        </Field>
        {!finding.text && (
          <p className="hint">
            No selected text was available. Enter an observation manually, or
            highlight text on the page and use the right-click capture menu.
          </p>
        )}
        <Field label="Source name">
          <input
            value={f.sourceName}
            onChange={(e) => update("sourceName", e.target.value)}
          />
        </Field>
        <Field label="Source URL">
          <input
            type="url"
            value={f.sourceUrl}
            onChange={(e) => update("sourceUrl", e.target.value)}
          />
        </Field>
        <Field label="Page title">
          <input
            value={f.pageTitle}
            onChange={(e) => update("pageTitle", e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select
              value={f.category}
              onChange={(e) => update("category", e.target.value)}
            >
              {findingCategories.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Assessment">
            <select
              value={f.assessment}
              onChange={(e) => update("assessment", e.target.value)}
            >
              {assessments.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Confidence">
            <select
              value={f.confidence}
              onChange={(e) => update("confidence", e.target.value)}
            >
              {confidences.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Identifier type">
            <select
              value={f.identifierType}
              onChange={(e) => update("identifierType", e.target.value)}
            >
              {identifierTypes.map((v) => (
                <option key={v} value={v}>
                  {human(v)}
                </option>
              ))}
            </select>
          </Field>
        </div>
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
        <Field label="Analyst note">
          <textarea
            value={f.analystNote}
            onChange={(e) => update("analystNote", e.target.value)}
          />
        </Field>
        <details className="provenance">
          <summary>Original source provenance (retained)</summary>
          <p>{f.provenance.pageTitle || "Manual entry"}</p>
          <p className="break">
            {f.provenance.sourceUrl || "No page URL captured"}
          </p>
          <p>{f.provenance.domain}</p>
          <time>{new Date(f.provenance.capturedAt).toLocaleString()}</time>
        </details>
        <div className="form-actions">
          <button className="primary">Save finding</button>
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
