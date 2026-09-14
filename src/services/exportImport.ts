import { caseSchema, type ResearchCase } from "../types";
import { z } from "zod";
export const exportSchema = z.object({
  schemaVersion: z.literal(2),
  case: caseSchema,
});
export function serializeCase(c: ResearchCase) {
  return JSON.stringify(
    { schemaVersion: 2, case: caseSchema.parse(c) },
    null,
    2,
  );
}
export function importCase(text: string): ResearchCase {
  if (text.length > 10_000_000)
    throw Error("The imported file exceeds the 10 MB limit.");
  try {
    const raw = JSON.parse(text) as Record<string, any>;
    if (raw?.schemaVersion === 1 && raw.case) {
      raw.schemaVersion = 2;
      raw.case = {
        ...raw.case,
        identifiers: (raw.case.identifiers || []).map((identifier: Record<string, any>) => ({
          ...identifier,
          status:
            identifier.status === "verified"
              ? "verified"
              : identifier.source === "Analyst entry"
                ? "analyst_supplied"
                : "unverified_lead",
        })),
        searchRuns: [],
        searchHistory: [],
        leads: [],
      };
    }
    return exportSchema.parse(raw).case;
  } catch (e) {
    throw Error(
      "The imported case file is invalid. " +
        (e instanceof z.ZodError
          ? e.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : "Expected a version 1 or 2 research-case.json file."),
    );
  }
}
export function download(
  name: string,
  text: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
