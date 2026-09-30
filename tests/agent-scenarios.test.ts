import { describe, expect, it } from "vitest";
import { runScenario, scenarioNames } from "@/lib/testing/scenarios";

describe("NEXUS deterministic agent scenarios", () => {
  it.each(scenarioNames)("produces a clear result for %s", (name) => {
    const result = runScenario(name);
    expect(result.name).toBe(name);
    expect(result.finalOutcome.length).toBeGreaterThan(0);
    expect(result.completionTimeMs).toBeGreaterThan(0);
  });

  it("does not claim success after final verification failure", () => {
    expect(runScenario("final verification failure").success).toBe(false);
    expect(runScenario("final verification failure").verificationResult).toBe("FAIL");
  });

  it("keeps approval and retry policy bounded", () => {
    const approval = runScenario("human approval");
    expect(approval.approvalEvents).toBe(1);
    expect(runScenario("recovery attempt").retries).toBe(1);
    expect(runScenario("recovery attempt").retries).toBeLessThanOrEqual(2);
  });
});
