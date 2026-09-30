export type VerificationResult = { verified: boolean; confidence: number; summary: string };

export function verifyExpectedOutcome(expected: string, actual: string | undefined): VerificationResult {
  if (!actual) return { verified: false, confidence: 0, summary: "No observable outcome was recorded" };
  const expectedTerms = expected.toLowerCase().split(/\W+/).filter(Boolean);
  const actualText = actual.toLowerCase();
  const matched = expectedTerms.filter((term) => actualText.includes(term)).length;
  const confidence = expectedTerms.length === 0 ? 0 : matched / expectedTerms.length;
  return { verified: confidence >= 0.5, confidence, summary: confidence >= 0.5 ? "Expected outcome is supported by observed evidence" : "Observed evidence does not support the expected outcome" };
}
