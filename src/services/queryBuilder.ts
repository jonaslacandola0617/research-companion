import {
  httpUrl,
  type Identifier,
  type IdentifierType,
  type ResearchCase,
  type ResearchSource,
} from "../types";
import { queryTemplates } from "../config/queryTemplates";
export function detectIdentifierType(
  value: string,
): IdentifierType | undefined {
  const s = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "email";
  if (/^@[\w.-]+$/.test(s)) return "username";
  if (/^https?:\/\/\S+$/i.test(s)) return "website";
  if (
    /^[+()\d .-]+$/.test(s) &&
    s.replace(/\D/g, "").length >= 7 &&
    s.replace(/\D/g, "").length <= 15
  )
    return "phone";
  if (s.includes(",")) return "address";
  return undefined;
}
export const templateVariables = [
  "query",
  "name",
  "firstName",
  "lastName",
  "username",
  "email",
  "phone",
  "city",
  "state",
];
export function validateTemplate(template: string) {
  if (!template) return;
  const names = [...template.matchAll(/\{([^{}]+)\}/g)].map((x) => x[1]);
  if (names.some((n) => !templateVariables.includes(n)))
    throw Error("Unknown template variable.");
  const url = httpUrl.parse(template.replace(/\{[^{}]+\}/g, "sample"));
  const parsed = new URL(url);
  if (
    /[{}]/.test(parsed.origin) ||
    /[{}]/.test(template.replace(/\{[^{}]+\}/g, ""))
  )
    throw Error("Invalid template.");
  const origin = template.split("/").slice(0, 3).join("/");
  if (origin.includes("{"))
    throw Error(
      "Template variables belong in the path or query, never the hostname.",
    );
}
export function buildSearchUrl(
  source: ResearchSource,
  identifier: Identifier,
  c: ResearchCase,
) {
  if (!source.enabled) throw Error("This source is disabled.");
  if (!source.supportedIdentifiers.includes(identifier.type))
    throw Error(`This source does not support ${identifier.type} searches.`);
  if (source.strategy === "homepage") return httpUrl.parse(source.homepage);
  validateTemplate(source.template);
  const value = (type: IdentifierType) =>
    identifier.type === type
      ? identifier.value
      : c.identifiers.find((i) => i.type === type)?.value || "";
  const vars: Record<string, string> = {
    query: identifier.value,
    name: identifier.type === "name" ? identifier.value : c.subjectName,
    firstName: c.profile.firstName,
    lastName: c.profile.lastName,
    username: value("username"),
    email: value("email"),
    phone: value("phone"),
    city: value("city") || c.profile.city,
    state: value("state") || c.profile.state,
  };
  return httpUrl.parse(
    source.template.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (!vars[key]?.trim())
        throw Error(`Add a ${key} value before searching this source.`);
      return encodeURIComponent(vars[key]);
    }),
  );
}
export function buildQueries(c: ResearchCase) {
  const quote = (s: string) => '"' + s.replace(/"/g, "").trim() + '"';
  const get = (t: IdentifierType, fallback = "") =>
    c.identifiers.find((i) => i.type === t)?.value || fallback;
  const values: Record<string, string> = {
    name: c.subjectName,
    city: get("city", c.profile.city),
    state: get("state", c.profile.state),
    employer: get("employer", c.profile.employers.split("\n")[0]),
    relative: get("relative", c.profile.relatives.split("\n")[0]),
    username: get("username", c.profile.usernames.split("\n")[0]),
  };
  return [
    ...new Set(
      queryTemplates
        .filter((t) =>
          [...t.matchAll(/\{(\w+)\}/g)].every((m) => values[m[1]]?.trim()),
        )
        .map((t) =>
          t.replace(/\{(\w+)\}/g, (_, key: string) => quote(values[key])),
        ),
    ),
  ];
}
