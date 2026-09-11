import { useState } from "react";
import {
  activity,
  confidences,
  identifierTypes,
  makeIdentifier,
  type Identifier,
} from "../../types";
import { detectIdentifierType } from "../../services/queryBuilder";
import { useWorkspace } from "../workspace";
import { Field, human, Modal } from "./ui";
export function IdentifierEditor({
  initial,
  close,
}: {
  initial?: Identifier;
  close: () => void;
}) {
  const { c, save, run } = useWorkspace();
  const [value, setValue] = useState<Identifier>(
    initial || makeIdentifier("other", ""),
  );
  const suggested = detectIdentifierType(value.value);
  const update = (key: keyof Identifier, v: string) =>
    setValue({ ...value, [key]: v });
  return (
    <Modal title={initial ? "Edit identifier" : "Add identifier"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            if (!c) return;
            const next = structuredClone(c);
            const index = next.identifiers.findIndex((i) => i.id === value.id);
            const clean = { ...value, value: value.value.trim() };
            if (index >= 0) next.identifiers[index] = clean;
            else next.identifiers.push(clean);
            activity(
              next,
              "identifier",
              `${index >= 0 ? "Updated" : "Added"} ${value.type}: ${value.value}`,
            );
            await save(next);
            close();
          });
        }}
      >
        <Field label="Value">
          <input
            required
            value={value.value}
            onChange={(e) => update("value", e.target.value)}
            autoFocus
          />
        </Field>
        {suggested && (
          <p className="hint">
            Suggested type: {human(suggested)}{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => update("type", suggested)}
            >
              Use suggestion
            </button>
          </p>
        )}
        <div className="form-grid">
          <Field label="Type">
            <select
              value={value.type}
              onChange={(e) => update("type", e.target.value)}
            >
              {identifierTypes.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Confidence">
            <select
              value={value.confidence}
              onChange={(e) => update("confidence", e.target.value)}
            >
              {confidences.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Source">
          <input
            value={value.source}
            onChange={(e) => update("source", e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <textarea
            value={value.notes}
            onChange={(e) => update("notes", e.target.value)}
          />
        </Field>
        <Field label="Verification">
          <select
            value={value.status}
            onChange={(e) => update("status", e.target.value)}
          >
            <option value="unverified">Unverified</option>
            <option value="verified">Verified by analyst</option>
          </select>
        </Field>
        <button className="primary" type="submit">
          Save identifier
        </button>
      </form>
    </Modal>
  );
}
export function IdentifierChip({ identifier: i }: { identifier: Identifier }) {
  const { c, save, run, editIdentifier, pivot, notify, state } = useWorkspace();
  const [open, setOpen] = useState(false);
  const names = [
    "Google",
    "Bing",
    "DuckDuckGo",
    "WhatsMyName",
    "IDCrawl",
    "Facebook",
    "Instagram",
    "X",
    "Reddit",
    "TikTok",
  ];
  return (
    <>
      <button
        className={"chip " + (i.status === "verified" ? "verified" : "")}
        onClick={() => setOpen(true)}
      >
        <span>{i.status === "verified" ? "✓" : "#"}</span>
        {i.value}
      </button>
      {open && (
        <Modal title={i.value} close={() => setOpen(false)}>
          <p className="eyebrow">
            {human(i.type)} · {i.confidence} confidence · {i.status}
          </p>
          {i.notes && <p>{i.notes}</p>}
          <p className="hint">Source: {i.source || "Not specified"}</p>
          <h3>Search with</h3>
          <div className="button-grid">
            {state.settings.sources
              .filter(
                (s) =>
                  names.includes(s.name) &&
                  s.enabled &&
                  s.supportedIdentifiers.includes(i.type),
              )
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    pivot(i, s.id);
                    setOpen(false);
                  }}
                >
                  {s.name}
                </button>
              ))}
          </div>
          <hr />
          <div className="button-grid">
            <button
              onClick={() =>
                void run(async () => {
                  await navigator.clipboard.writeText(i.value);
                  notify("Identifier copied.");
                })
              }
            >
              Copy
            </button>
            <button
              onClick={() => {
                setOpen(false);
                editIdentifier(i);
              }}
            >
              Edit / add note
            </button>
            <button
              onClick={() =>
                void run(async () => {
                  if (!c) return;
                  const next = structuredClone(c);
                  next.identifiers.find((x) => x.id === i.id)!.status =
                    i.status === "verified" ? "unverified" : "verified";
                  activity(
                    next,
                    "identifier",
                    `Verification changed: ${i.value}`,
                  );
                  await save(next);
                  setOpen(false);
                })
              }
            >
              Mark {i.status === "verified" ? "unverified" : "verified"}
            </button>
            <button
              className="danger"
              onClick={() =>
                void run(async () => {
                  if (!c || !confirm(`Remove identifier “${i.value}”?`)) return;
                  const next = structuredClone(c);
                  next.identifiers = next.identifiers.filter(
                    (x) => x.id !== i.id,
                  );
                  next.candidates.forEach(
                    (candidate) => delete candidate.comparisons[i.id],
                  );
                  activity(
                    next,
                    "identifier",
                    `Removed identifier: ${i.value}`,
                  );
                  await save(next);
                  setOpen(false);
                })
              }
            >
              Remove
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
