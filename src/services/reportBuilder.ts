import type { ResearchCase, ResearchSource } from "../types";
export function buildReport(
  c: ResearchCase,
  sources: ResearchSource[],
  markdown = true,
) {
  const h = (s: string) => (markdown ? "## " + s : s);
  const candidate = (item: ResearchCase["candidates"][number]) =>
    `${item.name} — ${item.classification} (analyst-selected). ${item.rationale ? `Analyst rationale: ${item.rationale}` : "Insufficient information was available to establish an association."}\n${item.identifiers.map((i) => `  ${i.type}: ${i.value}`).join("\n")}\n${Object.values(
      item.comparisons,
    )
      .map(
        (cell) =>
          `  ${c.identifiers.find((i) => i.id === cell.identifierId)?.value || cell.identifierId}: ${cell.status}${cell.note ? " — " + cell.note : ""}`,
      )
      .join("\n")}`;
  const list = (items: string[]) =>
    items.length ? items.map((v) => "- " + v).join("\n") : "None recorded.";
  return [
    markdown
      ? "# Research Companion — Research Summary"
      : "RESEARCH COMPANION — RESEARCH SUMMARY",
    c.demo
      ? "FICTIONAL DEMO DATA — all records and classifications are illustrative."
      : "Analyst-controlled research summary. Associations are assessments, not identity determinations.",
    h("CASE INFORMATION"),
    `Subject: ${c.subjectName}\nCase ID: ${c.id}\nCreated: ${c.createdAt}\nLast modified: ${c.modifiedAt}\nArchived: ${c.archived ? "Yes" : "No"}\n` +
      Object.entries(c.profile)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n"),
    h("KEY IDENTIFIERS"),
    list(
      c.identifiers.map(
        (i) =>
          `${i.type}: ${i.value} [${i.status}; ${i.confidence} confidence]\n  Source: ${i.source || "Analyst entry"}${i.notes ? "\n  Note: " + i.notes : ""}`,
      ),
    ),
    h("LIKELY ASSOCIATED RECORDS"),
    list(
      c.candidates
        .filter((x) => x.classification === "Likely Match")
        .map(
          (x) =>
            `Likely associated based on the analyst's assessment:\n${candidate(x)}`,
        ),
    ),
    h("POSSIBLE ASSOCIATIONS"),
    list(
      c.candidates
        .filter((x) =>
          ["Possible Match", "Unreviewed", "Insufficient Evidence"].includes(
            x.classification,
          ),
        )
        .map(
          (x) =>
            `Potentially associated; could not be independently verified by this software.\n${candidate(x)}`,
        ),
    ),
    h("EXCLUDED / UNLIKELY ASSOCIATIONS"),
    list(
      c.candidates
        .filter((x) =>
          ["Excluded", "Unlikely Match"].includes(x.classification),
        )
        .map(
          (x) =>
            `The analyst marked this record ${x.classification.toLowerCase()}.\n${candidate(x)}`,
        ),
    ),
    h("CAPTURED FINDINGS"),
    list(
      c.findings.map(
        (f) =>
          `${f.title}\n  Observation: ${f.text}\n  Assessment: ${f.assessment}; confidence: ${f.confidence}\n  Category: ${f.category}; related identifier: ${f.relatedIdentifier || "Not specified"}\n  Source: ${f.sourceName} — ${f.sourceUrl || "Manual entry"}\n  Original provenance: ${f.provenance.sourceUrl || "Manual entry"} | ${f.provenance.pageTitle} | ${f.provenance.domain} | ${f.provenance.capturedAt}\n  Analyst note: ${f.analystNote || "None"}`,
      ),
    ),
    h("DISCREPANCIES"),
    list(
      c.discrepancies.map(
        (d) =>
          `${d.title} [${d.status}]\n  Conflicting information was identified: ${d.sourceA}: ${d.valueA}; ${d.sourceB}: ${d.valueB}.\n  Possible explanation (analyst): ${d.explanation || "Not provided"}.\n  Notes: ${d.notes || "None"}`,
      ),
    ),
    h("UNRESOLVED ITEMS"),
    list([
      ...c.discrepancies
        .filter((d) => d.status === "Unresolved")
        .map((d) => d.title),
      ...c.findings
        .filter((f) => f.assessment === "Requires Review")
        .map((f) => "Review finding: " + f.title),
      ...c.candidates
        .filter((x) =>
          ["Unreviewed", "Insufficient Evidence"].includes(x.classification),
        )
        .map((x) => "Review candidate: " + x.name),
      ...Object.values(c.checklist)
        .filter(
          (s) => s.status === "needs_review" || s.status === "unavailable",
        )
        .map(
          (s) =>
            `${sources.find((x) => x.id === s.sourceId)?.name || s.sourceId}: ${s.status}`,
        ),
    ]),
    h("SOURCES REVIEWED"),
    list(
      Object.values(c.checklist)
        .filter((s) => s.status !== "not_checked")
        .map(
          (s) =>
            `${sources.find((x) => x.id === s.sourceId)?.name || s.sourceId}: ${s.status.replaceAll("_", " ")}. ${s.notes}`,
        ),
    ),
    h("ANALYST NOTES"),
    c.notes || "No case notes recorded.",
    h("RESEARCH TRAIL"),
    list(c.activity.map((e) => `${e.at} — ${e.message}`)),
  ].join("\n\n");
}
