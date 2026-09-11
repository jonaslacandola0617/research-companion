import { useState } from "react";
import {
  activity,
  profileFields,
  makeIdentifier,
  type IdentifierType,
} from "../../types";
import { useWorkspace } from "../workspace";
import { AddButton, Field, Section, human } from "../components/ui";
import { IdentifierChip } from "../components/IdentifierEditor";
import { mutate } from "../../services/storage";
export function CasePage() {
  const { c, save, run, editIdentifier, refresh, navigate } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState("");
  if (!c) return null;
  const checked = Object.values(c.checklist).filter(
    (s) => s.status !== "not_checked",
  ).length;
  return (
    <>
      <div className="page-title">
        <div>
          <span className="eyebrow">CASE WORKSPACE</span>
          <h1>Build the picture.</h1>
          <p>Keep identifiers, evidence, and decisions connected.</p>
        </div>
      </div>
      {c.demo && (
        <div className="notice">
          FICTIONAL DEMO DATA · All records and assessments are illustrative.
        </div>
      )}
      <div className="stats">
        <button
          onClick={() =>
            document.getElementById("identifiers")?.scrollIntoView()
          }
        >
          <strong>{c.identifiers.length}</strong>
          <span>Identifiers</span>
        </button>
        <button onClick={() => navigate("FINDINGS")}>
          <strong>{c.findings.length}</strong>
          <span>Findings</span>
        </button>
        <button onClick={() => navigate("SEARCH")}>
          <strong>{checked}</strong>
          <span>Sources checked</span>
        </button>
      </div>
      <Section
        title="Subject overview"
        action={
          <button className="text-button" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit details"}
          </button>
        }
      >
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void run(async () => {
                const next = structuredClone(c);
                next.subjectName = String(data.get("subjectName")).trim();
                next.notes = String(data.get("notes"));
                for (const key of profileFields)
                  next.profile[key] = String(data.get(key) || "");
                activity(
                  next,
                  "note",
                  "Subject details and case notes updated",
                );
                await save(next);
                setEditing(false);
              });
            }}
          >
            <Field label="Subject name">
              <input name="subjectName" required defaultValue={c.subjectName} />
            </Field>
            <div className="form-grid">
              {profileFields.map((key) => (
                <Field
                  key={key}
                  label={key
                    .replace(/([A-Z])/g, " $1")
                    .replace(/^./, (x) => x.toUpperCase())}
                >
                  <input name={key} defaultValue={c.profile[key]} />
                </Field>
              ))}
            </div>
            <Field label="Case notes">
              <textarea name="notes" defaultValue={c.notes} />
            </Field>
            <button className="primary">Save details</button>
          </form>
        ) : (
          <>
            <h3 className="subject-name">{c.subjectName}</h3>
            <dl className="details-list">
              {profileFields
                .filter((k) => c.profile[k])
                .map((k) => (
                  <div key={k}>
                    <dt>{human(k.replace(/([A-Z])/g, " $1"))}</dt>
                    <dd>{c.profile[k]}</dd>
                  </div>
                ))}
            </dl>
            {!profileFields.some((k) => c.profile[k]) && (
              <p className="hint">
                Add locations, contact information, and known associations.
              </p>
            )}
            {c.notes && <p className="preserve">{c.notes}</p>}
            <button
              className="subtle"
              onClick={() =>
                void run(async () => {
                  const map: Record<string, IdentifierType> = {
                    aliases: "alias",
                    age: "age",
                    dateOfBirth: "date_of_birth",
                    city: "city",
                    state: "state",
                    country: "country",
                    previousLocations: "address",
                    employers: "employer",
                    schools: "school",
                    relatives: "relative",
                    usernames: "username",
                    emails: "email",
                    phones: "phone",
                    otherIdentifiers: "other",
                  };
                  const next = structuredClone(c);
                  const values = [
                    { type: "name" as IdentifierType, value: c.subjectName },
                    ...Object.entries(map).flatMap(([k, type]) =>
                      c.profile[k as keyof typeof c.profile]
                        .split(/[;\n]/)
                        .filter((v) => v.trim())
                        .map((value) => ({ type, value: value.trim() })),
                    ),
                  ];
                  let count = 0;
                  for (const { type, value } of values)
                    if (
                      !next.identifiers.some(
                        (i) => i.type === type && i.value === value,
                      )
                    ) {
                      next.identifiers.push(makeIdentifier(type, value));
                      count++;
                    }
                  activity(
                    next,
                    "identifier",
                    `${count} subject values converted to identifiers`,
                  );
                  await save(next);
                })
              }
            >
              Convert details to identifiers
            </button>
          </>
        )}
      </Section>
      <div id="identifiers">
        <Section
          title="Known identifiers"
          description="Select an identifier to search, verify, or add context."
          action={<AddButton onClick={() => editIdentifier()}>Add</AddButton>}
        >
          <input
            aria-label="Filter identifiers"
            placeholder="Filter identifiers…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div className="chips">
            {c.identifiers
              .filter((i) =>
                `${i.value} ${i.type}`
                  .toLowerCase()
                  .includes(filter.toLowerCase()),
              )
              .map((i) => (
                <IdentifierChip key={i.id} identifier={i} />
              ))}
          </div>
          {!c.identifiers.length && (
            <p className="hint">
              Start with a name, username, email, or location.
            </p>
          )}
        </Section>
      </div>
      <Section
        title="Research trail"
        description="A chronological record of this case."
      >
        <div className="timeline">
          {c.activity
            .slice()
            .reverse()
            .slice(0, 100)
            .map((a) => (
              <div className="timeline-item" key={a.id}>
                <span className="timeline-dot" />
                <div>
                  <p>{a.message}</p>
                  <time>{new Date(a.at).toLocaleString()}</time>
                </div>
              </div>
            ))}
        </div>
        {c.activity.length > 100 && (
          <p className="hint">
            Showing the latest 100 events. Full trail is included in JSON
            export.
          </p>
        )}
      </Section>
      <Section title="Case management">
        <div className="button-grid">
          <button
            onClick={() =>
              void run(async () => {
                await mutate({ type: "duplicate", id: c.id });
                await refresh();
              })
            }
          >
            Duplicate case
          </button>
          <button
            onClick={() =>
              void run(async () => {
                await mutate({ type: "archive", id: c.id });
                await refresh();
              })
            }
          >
            {c.archived ? "Restore case" : "Archive case"}
          </button>
          <button
            className="danger"
            onClick={() => {
              if (
                confirm(
                  `Delete “${c.subjectName}” and all its saved research? This cannot be undone.`,
                )
              )
                void run(async () => {
                  await mutate({ type: "delete", id: c.id });
                  await refresh();
                });
            }}
          >
            Delete case
          </button>
        </div>
        <p className="metadata">
          Case {c.id}
          <br />
          Created {new Date(c.createdAt).toLocaleString()}
          <br />
          Updated {new Date(c.modifiedAt).toLocaleString()}
        </p>
      </Section>
    </>
  );
}
