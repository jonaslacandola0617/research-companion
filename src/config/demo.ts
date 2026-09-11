import {
  activity,
  createCase,
  makeIdentifier,
  now,
  uuid,
  type Candidate,
} from "../types";
export function createDemoCase() {
  const c = createCase("Daniel Luis Ramirez");
  c.demo = true;
  c.profile = {
    ...c.profile,
    firstName: "Daniel",
    middleName: "Luis",
    lastName: "Ramirez",
    age: "34",
    city: "Angeles City",
    country: "Philippines",
    previousLocations: "Quezon City",
    employers: "Vertex Global Solutions",
    relatives: "Maria Ramirez",
    usernames: "danramirez88",
  };
  c.notes =
    "FICTIONAL DEMO DATA. These synthetic profiles and records are solely for demonstrating the workspace. No real-world association is asserted.";
  c.identifiers = [
    makeIdentifier("name", c.subjectName),
    makeIdentifier("age", "34"),
    makeIdentifier("city", "Angeles City"),
    makeIdentifier("employer", "Vertex Global Solutions"),
    makeIdentifier("occupation", "Operations Supervisor"),
    makeIdentifier("relative", "Maria Ramirez"),
    makeIdentifier("username", "danramirez88"),
  ];
  c.identifiers.forEach((i) => (i.source = "FICTIONAL DEMO DATA"));
  const candidate = (
    name: string,
    age: string,
    city: string,
    classification: Candidate["classification"],
    rationale: string,
  ): Candidate => ({
    id: uuid(),
    name,
    identifiers: [makeIdentifier("age", age), makeIdentifier("city", city)],
    classification,
    rationale,
    comparisons: {},
  });
  c.candidates = [
    candidate(
      "Daniel L. Ramirez · Fictional A",
      "34",
      "Angeles City",
      "Possible Match",
      "Illustrative strong possible match: age, city, relative, and employer align. Independent corroboration still required.",
    ),
    candidate(
      "D. Ramirez · Fictional B",
      "34",
      "Quezon City",
      "Insufficient Evidence",
      "Illustrative ambiguous match: similar name and age; current location is unresolved.",
    ),
    candidate(
      "Daniel Ramirez · Fictional C",
      "51",
      "Cebu City",
      "Excluded",
      "Illustrative false positive: age, location, and occupation conflict.",
    ),
  ];
  c.candidates[0].identifiers.push(
    makeIdentifier("relative", "Maria Ramirez"),
    makeIdentifier("employer", "Vertex Global Solutions"),
  );
  c.candidates.forEach((candidate, index) => {
    c.identifiers.forEach((i) => {
      candidate.comparisons[i.id] = {
        identifierId: i.id,
        status:
          index === 0
            ? i.type === "username"
              ? "Unknown"
              : "Match"
            : index === 1
              ? i.type === "age"
                ? "Match"
                : i.type === "name"
                  ? "Partial Match"
                  : "Unknown"
              : i.type === "name"
                ? "Partial Match"
                : "Conflict",
        note: "FICTIONAL DEMO DATA — illustrative analyst assessment",
      };
    });
  });
  const capturedAt = now();
  c.findings = [
    {
      id: uuid(),
      caseId: c.id,
      title: "Employer appears in fictional profile",
      text: "Operations Supervisor at Vertex Global Solutions, Angeles City.",
      sourceName: "Fictional profile",
      sourceUrl: "https://example.com/fictional-profile",
      pageTitle: "FICTIONAL DEMO DATA — sample profile",
      domain: "example.com",
      identifierType: "employer",
      relatedIdentifier: "Vertex Global Solutions",
      category: "Employment",
      analystNote:
        "Illustrative supporting observation. Further corroboration required.",
      assessment: "Supporting",
      confidence: "Medium",
      capturedAt,
      provenance: {
        sourceUrl: "https://example.com/fictional-profile",
        pageTitle: "FICTIONAL DEMO DATA — sample profile",
        domain: "example.com",
        capturedAt,
      },
    },
  ];
  c.discrepancies = [
    {
      id: uuid(),
      title: "Current versus historical location",
      sourceA: "Fictional professional profile",
      valueA: "Angeles City",
      sourceB: "Fictional directory",
      valueB: "Quezon City",
      explanation: "May reflect a historical address; not established.",
      notes: "FICTIONAL DEMO DATA",
      status: "Unresolved",
    },
  ];
  c.checklist.google = {
    sourceId: "google",
    status: "searched",
    notes: "Fictional demonstration only; no actual search was performed.",
    updatedAt: now(),
  };
  activity(
    c,
    "case",
    "FICTIONAL DEMO DATA loaded; classifications and comparisons are illustrative",
  );
  return c;
}
