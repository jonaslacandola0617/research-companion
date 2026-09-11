import {
  type Candidate,
  type CandidateIdentifierComparison,
  type ResearchCase,
} from "../types";
export function setComparison(
  candidate: Candidate,
  identifierId: string,
  status: CandidateIdentifierComparison["status"],
  note = "",
): Candidate {
  return {
    ...candidate,
    comparisons: {
      ...candidate.comparisons,
      [identifierId]: { identifierId, status, note },
    },
  };
}
export function comparisonRows(c: ResearchCase) {
  return c.identifiers.map((i) => ({
    identifier: i,
    cells: c.candidates.map((candidate) => ({
      candidateId: candidate.id,
      ...(candidate.comparisons[i.id] || {
        identifierId: i.id,
        status: "Unknown" as const,
        note: "",
      }),
    })),
  }));
}
