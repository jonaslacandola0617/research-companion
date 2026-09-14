import { z } from "zod";
export const identifierTypes = [
  "name",
  "first_name",
  "middle_name",
  "last_name",
  "suffix",
  "alias",
  "username",
  "email",
  "phone",
  "address",
  "previous_location",
  "city",
  "state",
  "country",
  "employer",
  "occupation",
  "school",
  "relative",
  "date_of_birth",
  "age",
  "website",
  "social_profile",
  "other",
] as const;
export const identifierStatuses = [
  "analyst_supplied",
  "verified",
  "unverified_lead",
] as const;
export const confidences = ["Unrated", "Low", "Medium", "High"] as const;
export const assessments = [
  "Supporting",
  "Conflicting",
  "Neutral",
  "Requires Review",
] as const;
export const classifications = [
  "Unreviewed",
  "Likely Match",
  "Possible Match",
  "Insufficient Evidence",
  "Unlikely Match",
  "Excluded",
] as const;
export const matches = [
  "Match",
  "Partial Match",
  "Conflict",
  "Unknown",
  "Not Applicable",
] as const;
export const statuses = [
  "not_checked",
  "searched",
  "finding_found",
  "no_relevant_result",
  "needs_review",
  "unavailable",
] as const;
export const findingCategories = [
  "Identity",
  "Location",
  "Employment",
  "Education",
  "Relative",
  "Contact",
  "Username",
  "Social Media",
  "Public Record",
  "Timeline",
  "Other",
] as const;
export const categories = [
  "PSE",
  "SEARCH",
  "1ST SM",
  "TOP SOCMED",
  "SUB SOC",
  "ARREST",
  "GSR",
] as const;
const text = z.string().max(100000);
const id = z.string().uuid();
const date = z.string().datetime();
export const httpUrl = z
  .string()
  .max(8192)
  .refine((v) => {
    try {
      const u = new URL(v);
      return (
        ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
      );
    } catch {
      return false;
    }
  }, "Use a complete http:// or https:// URL without credentials.");
export const identifierSchema = z.object({
  id,
  type: z.enum(identifierTypes),
  value: text.min(1),
  source: text,
  notes: text,
  createdAt: date,
  confidence: z.enum(confidences),
  status: z.enum(identifierStatuses),
});
export const provenanceSchema = z.object({
  sourceUrl: z.union([httpUrl, z.literal("")]),
  pageTitle: text,
  domain: text,
  capturedAt: date,
});
export const findingSchema = z.object({
  id,
  caseId: id,
  title: text.min(1),
  text,
  sourceName: text,
  sourceUrl: z.union([httpUrl, z.literal("")]),
  pageTitle: text,
  domain: text,
  identifierType: z.enum(identifierTypes),
  relatedIdentifier: text,
  category: z.enum(findingCategories),
  analystNote: text,
  assessment: z.enum(assessments),
  confidence: z.enum(confidences),
  capturedAt: date,
  provenance: provenanceSchema,
});
export const comparisonSchema = z.object({
  identifierId: id,
  status: z.enum(matches),
  note: text,
});
export const candidateSchema = z.object({
  id,
  name: text.min(1),
  identifiers: z.array(identifierSchema).max(10000),
  classification: z.enum(classifications),
  rationale: text,
  comparisons: z.record(comparisonSchema),
});
export const discrepancySchema = z.object({
  id,
  title: text.min(1),
  sourceA: text,
  valueA: text,
  sourceB: text,
  valueB: text,
  explanation: text,
  notes: text,
  status: z.enum(["Unresolved", "Resolved"]),
});
export const activitySchema = z.object({
  id,
  at: date,
  type: z.enum([
    "case",
    "search",
    "finding",
    "identifier",
    "candidate",
    "note",
    "discrepancy",
    "source",
  ]),
  message: text,
});
export const checklistSchema = z.object({
  sourceId: text,
  status: z.enum(statuses),
  notes: text,
  updatedAt: date,
});
export const searchEventSchema = z.object({
  id,
  sourceId: text,
  query: text,
  url: httpUrl,
  at: date,
});
export const deepSearchTaskStatuses = [
  "planned",
  "opened",
  "reviewed",
  "useful_lead",
  "no_useful_result",
  "unavailable",
  "blocked",
  "skipped",
] as const;
export const deepSearchTaskSchema = z.object({
  id: text.min(1),
  query: text.min(1),
  normalizedQuery: text.min(1),
  url: httpUrl,
  engineSourceId: z.enum(["google", "bing", "duckduckgo"]),
  reason: text.min(1),
  targetSourceId: text.optional(),
  targetSourceName: text.optional(),
  category: z.enum(categories),
  priority: z.number().int().min(1).max(100),
  searchPriority: z.enum(["very_strong", "strong", "medium", "weak"]),
  identifierIds: z.array(text).max(100),
  interaction: z.enum(["direct", "search-engine-site-query", "manual"]),
  status: z.enum(deepSearchTaskStatuses),
  enabled: z.boolean(),
  requiresIndependentVerification: z.boolean(),
  openedAt: date.optional(),
  reviewedAt: date.optional(),
});
export const searchRunSchema = z.object({
  id,
  caseId: id,
  createdAt: date,
  updatedAt: date,
  status: z.enum(["planned", "running", "paused", "completed", "cancelled"]),
  wave: z.number().int().positive(),
  kind: z.enum(["initial", "continuation"]),
  seedIdentifierIds: z.array(text).max(10000),
  tasks: z.array(deepSearchTaskSchema).max(500),
  currentTaskIndex: z.number().int().nonnegative(),
  opened: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
});
export const searchHistoryEntrySchema = z.object({
  id,
  searchRunId: id,
  taskId: text,
  query: text,
  normalizedQuery: text,
  engineSourceId: z.enum(["google", "bing", "duckduckgo"]),
  targetSourceId: text.optional(),
  identifierIds: z.array(text),
  url: httpUrl,
  timestamp: date,
  status: z.enum(deepSearchTaskStatuses),
});
export const leadSchema = z.object({
  id,
  caseId: id,
  title: text.min(1),
  url: httpUrl,
  source: text,
  notes: text,
  relatedIdentifiers: z.array(text).max(1000),
  relevance: z.enum(["Strong", "Moderate", "Weak", "Unknown"]),
  reviewStatus: z.enum([
    "Unreviewed",
    "Relevant",
    "Not relevant",
    "Possible match",
    "Excluded",
  ]),
  createdAt: date,
  requiresIndependentVerification: z.boolean(),
});
export const profileFields = [
  "firstName",
  "middleName",
  "lastName",
  "suffix",
  "aliases",
  "age",
  "dateOfBirth",
  "city",
  "state",
  "country",
  "previousLocations",
  "employers",
  "schools",
  "relatives",
  "usernames",
  "emails",
  "phones",
  "otherIdentifiers",
] as const;
const profileSchema = z.object(
  Object.fromEntries(profileFields.map((k) => [k, text])) as Record<
    (typeof profileFields)[number],
    typeof text
  >,
);
export const caseSchema = z
  .object({
    id,
    subjectName: text.min(1),
    profile: profileSchema,
    notes: text,
    createdAt: date,
    modifiedAt: date,
    archived: z.boolean(),
    demo: z.boolean(),
    identifiers: z.array(identifierSchema).max(10000),
    findings: z.array(findingSchema).max(10000),
    candidates: z.array(candidateSchema).max(1000),
    discrepancies: z.array(discrepancySchema).max(10000),
    checklist: z.record(checklistSchema),
    searches: z.array(searchEventSchema).max(50000),
    searchRuns: z.array(searchRunSchema).max(1000),
    searchHistory: z.array(searchHistoryEntrySchema).max(50000),
    leads: z.array(leadSchema).max(10000),
    activity: z.array(activitySchema).max(50000),
  })
  .superRefine((c, ctx) => {
    const ids = [
      ...c.identifiers,
      ...c.findings,
      ...c.candidates,
      ...c.discrepancies,
    ].map((x) => x.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: "custom", message: "Duplicate record IDs." });
    if (c.findings.some((f) => f.caseId !== c.id))
      ctx.addIssue({
        code: "custom",
        message: "Finding belongs to another case.",
      });
    if (c.leads.some((lead) => lead.caseId !== c.id))
      ctx.addIssue({ code: "custom", message: "Lead belongs to another case." });
    if (c.searchRuns.some((run) => run.caseId !== c.id))
      ctx.addIssue({ code: "custom", message: "Search run belongs to another case." });
    for (const candidate of c.candidates)
      for (const [key, cell] of Object.entries(candidate.comparisons))
        if (
          key !== cell.identifierId ||
          !c.identifiers.some((i) => i.id === key)
        )
          ctx.addIssue({
            code: "custom",
            message: "Invalid comparison reference.",
          });
  });
export const sourceSchema = z.object({
  id: text.min(1),
  name: text.min(1),
  category: z.enum(categories),
  homepage: httpUrl,
  strategy: z.enum(["homepage", "template"]),
  template: text,
  interaction: z.enum(["direct", "search-engine-site-query", "manual"]),
  directTemplate: text,
  priority: z.number().int().min(1).max(100),
  requiresLogin: z.boolean(),
  potentiallyBlocked: z.boolean(),
  supportedIdentifiers: z.array(z.enum(identifierTypes)),
  enabled: z.boolean(),
  notes: text,
});
export const settingsSchema = z.object({
  theme: z.enum(["light", "dark"]),
  sources: z.array(sourceSchema).max(500),
  deepSearch: z.object({
    defaultTaskLimit: z.union([
      z.literal(12),
      z.literal(24),
      z.literal(36),
      z.literal(48),
      z.literal(60),
    ]),
    continuationTaskLimit: z.number().int().min(1).max(60),
    batchSize: z.union([z.literal(3), z.literal(5), z.literal(8), z.literal(10)]),
    includePublicRecords: z.boolean(),
    preferredEngines: z
      .array(z.enum(["google", "bing", "duckduckgo"]))
      .min(1)
      .max(3),
  }),
});
export const stateSchema = z.object({
  schemaVersion: z.literal(2),
  activeCaseId: z.union([id, z.null()]),
  cases: z.array(caseSchema).max(1000),
  settings: settingsSchema,
});
export type IdentifierType = (typeof identifierTypes)[number];
export type Identifier = z.infer<typeof identifierSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Candidate = z.infer<typeof candidateSchema>;
export type CandidateIdentifierComparison = z.infer<typeof comparisonSchema>;
export type ResearchCase = z.infer<typeof caseSchema>;
export type Case = ResearchCase;
export type ResearchSource = z.infer<typeof sourceSchema>;
export type SearchEvent = z.infer<typeof searchEventSchema>;
export type DeepSearchTask = z.infer<typeof deepSearchTaskSchema>;
export type DeepSearchTaskStatus = (typeof deepSearchTaskStatuses)[number];
export type SearchRun = z.infer<typeof searchRunSchema>;
export type SearchHistoryEntry = z.infer<typeof searchHistoryEntrySchema>;
export type Lead = z.infer<typeof leadSchema>;
export type ResearchChecklistItem = z.infer<typeof checklistSchema>;
export type Discrepancy = z.infer<typeof discrepancySchema>;
export type ActivityEvent = z.infer<typeof activitySchema>;
export type ExtensionSettings = z.infer<typeof settingsSchema>;
export type AppState = z.infer<typeof stateSchema>;
export type CaptureDraft = {
  id: string;
  caseId: string | null;
  mode: "finding" | "identifier" | "lead" | "search";
  text: string;
  pageTitle: string;
  sourceUrl: string;
  domain: string;
  capturedAt: string;
  identifierType?: IdentifierType;
  sourceId?: string;
};
export const uuid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function activity(
  c: ResearchCase,
  type: ActivityEvent["type"],
  message: string,
) {
  c.modifiedAt = new Date(
    Math.max(Date.now(), Date.parse(c.modifiedAt) + 1),
  ).toISOString();
  c.activity.push({ id: uuid(), at: now(), type, message });
}
export function createCase(subjectName: string): ResearchCase {
  return {
    id: uuid(),
    subjectName: subjectName.trim(),
    profile: Object.fromEntries(
      profileFields.map((k) => [k, ""]),
    ) as ResearchCase["profile"],
    notes: "",
    createdAt: now(),
    modifiedAt: now(),
    archived: false,
    demo: false,
    identifiers: [],
    findings: [],
    candidates: [],
    discrepancies: [],
    checklist: {},
    searches: [],
    searchRuns: [],
    searchHistory: [],
    leads: [],
    activity: [
      { id: uuid(), at: now(), type: "case", message: "Case created" },
    ],
  };
}
export function makeIdentifier(
  type: IdentifierType,
  value: string,
): Identifier {
  return {
    id: uuid(),
    type,
    value,
    source: "Analyst entry",
    notes: "",
    createdAt: now(),
    confidence: "Unrated",
    status: "analyst_supplied",
  };
}
