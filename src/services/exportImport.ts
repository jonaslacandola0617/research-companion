import { caseSchema, type ResearchCase } from "../types";
import { z } from "zod";
export const exportSchema = z.object({
  schemaVersion: z.literal(1),
  case: caseSchema,
});
export function serializeCase(c: ResearchCase) {
  return JSON.stringify(
    { schemaVersion: 1, case: caseSchema.parse(c) },
    null,
    2,
  );
}
export function importCase(text: string): ResearchCase {
  if (text.length > 10_000_000)
    throw Error("The imported file exceeds the 10 MB limit.");
  try {
    return exportSchema.parse(JSON.parse(text)).case;
  } catch (e) {
    throw Error(
      "The imported case file is invalid. " +
        (e instanceof z.ZodError
          ? e.issues
              .slice(0, 3)
              .map((i) => `${i.path.join(".")}: ${i.message}`)
              .join("; ")
          : "Expected a version 1 research-case.json file."),
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
