import { useState } from "react";
import { ExternalLink as ExternalLinkIcon, Plus } from "lucide-react";
import { activity, now, uuid, type Lead } from "../../types";
import { recognizeSource } from "../../config/researchSources";
import { useWorkspace } from "../workspace";
import { Empty, Field, Modal, Section } from "../components/ui";

export function LeadsPage() {
  const { c, state, save, run, draft, dismissDraft, capture } = useWorkspace();
  const [editing, setEditing] = useState<Lead | null>(null);
  if (!c) return null;

  const newLead = (): Lead => {
    const captured = draft?.mode === "lead" ? draft : undefined;
    const source = recognizeSource(captured?.sourceUrl || "", state.settings.sources);
    return {
      id: captured?.id || uuid(),
      caseId: c.id,
      title: captured?.pageTitle || captured?.text.slice(0, 120) || "",
      url: captured?.sourceUrl || "",
      source: source?.name || captured?.domain || "",
      notes: captured?.text || "",
      relatedIdentifiers: [],
      relevance: "Unknown",
      reviewStatus: "Unreviewed",
      createdAt: captured?.capturedAt || now(),
      requiresIndependentVerification:
        source?.category === "ARREST" || source?.id.includes("mugshot") || false,
    };
  };
  const lead = editing || (draft?.mode === "lead" ? newLead() : null);
  const close = () => {
    setEditing(null);
    if (draft?.mode === "lead") void run(dismissDraft);
  };

  return (
    <>
      <div className="page-title compact-title">
        <span className="eyebrow">LEADS</span>
        <h1>Promising pages, not conclusions.</h1>
        <p>Keep potential sources for analyst review without asserting that they belong to the POI.</p>
      </div>
      <div className="primary-action-row">
        <button className="primary full" onClick={() => void run(() => capture("lead"))}>Save current page as lead</button>
        <button className="text-button" onClick={() => setEditing(newLead())}><Plus size={14} /> Add manually</button>
      </div>
      <Section title={`${c.leads.length} ${c.leads.length === 1 ? "lead" : "leads"}`}>
        {!c.leads.length ? (
          <Empty title="No leads saved">Save a promising result, then assess its relevance yourself.</Empty>
        ) : (
          <div className="lead-list">
            {c.leads.slice().reverse().map((item) => (
              <article className="lead" key={item.id}>
                <span className="eyebrow">{item.source || "WEB LEAD"} · {item.relevance}</span>
                <h3>{item.title}</h3>
                <p>{item.notes}</p>
                {item.requiresIndependentVerification && <p className="verification-warning">Requires independent verification. A shared name is not evidence of identity.</p>}
                <div className="lead-actions">
                  <a href={item.url} target="_blank" rel="noreferrer"><ExternalLinkIcon size={13} /> Open source</a>
                  <span>{item.reviewStatus}</span>
                  <button className="text-button" onClick={() => setEditing(item)}>Review</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>
      {lead && (
        <Modal title={editing ? "Review lead" : "Save lead"} close={close}>
          <LeadEditor
            lead={lead}
            identifiers={c.identifiers.map((i) => ({ id: i.id, label: `${i.value} · ${i.type}` }))}
            onSave={(value) => void run(async () => {
              const next = structuredClone(c);
              const index = next.leads.findIndex((item) => item.id === value.id);
              if (index >= 0) next.leads[index] = value;
              else next.leads.push(value);
              activity(next, "finding", `${index >= 0 ? "Updated" : "Saved"} lead: ${value.title}`);
              await save(next);
              close();
            })}
            onDelete={editing ? () => void run(async () => {
              if (!confirm("Delete this lead?")) return;
              const next = structuredClone(c);
              next.leads = next.leads.filter((item) => item.id !== lead.id);
              await save(next);
              close();
            }) : undefined}
          />
        </Modal>
      )}
    </>
  );
}

function LeadEditor({
  lead,
  identifiers,
  onSave,
  onDelete,
}: {
  lead: Lead;
  identifiers: { id: string; label: string }[];
  onSave: (lead: Lead) => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(lead);
  return (
    <form onSubmit={(event) => { event.preventDefault(); onSave({ ...value, title: value.title.trim() }); }}>
      <Field label="Title"><input required autoFocus value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} /></Field>
      <Field label="URL"><input required type="url" value={value.url} onChange={(e) => setValue({ ...value, url: e.target.value })} /></Field>
      <Field label="Source"><input value={value.source} onChange={(e) => setValue({ ...value, source: e.target.value })} /></Field>
      <Field label="Analyst notes"><textarea value={value.notes} onChange={(e) => setValue({ ...value, notes: e.target.value })} /></Field>
      <div className="form-grid">
        <Field label="Relevance"><select value={value.relevance} onChange={(e) => setValue({ ...value, relevance: e.target.value as Lead["relevance"] })}>{["Strong", "Moderate", "Weak", "Unknown"].map((v) => <option key={v}>{v}</option>)}</select></Field>
        <Field label="Review status"><select value={value.reviewStatus} onChange={(e) => setValue({ ...value, reviewStatus: e.target.value as Lead["reviewStatus"] })}>{["Unreviewed", "Relevant", "Not relevant", "Possible match", "Excluded"].map((v) => <option key={v}>{v}</option>)}</select></Field>
      </div>
      <fieldset><legend>Related identifiers</legend><div className="identifier-checks">{identifiers.map((item) => <label className="check-label" key={item.id}><input type="checkbox" checked={value.relatedIdentifiers.includes(item.id)} onChange={(e) => setValue({ ...value, relatedIdentifiers: e.target.checked ? [...value.relatedIdentifiers, item.id] : value.relatedIdentifiers.filter((id) => id !== item.id) })} />{item.label}</label>)}</div></fieldset>
      <div className="form-actions"><button className="primary">Save lead</button>{onDelete && <button type="button" className="danger" onClick={onDelete}>Delete</button>}</div>
    </form>
  );
}
