import { describe, expect, it } from "vitest";
import { classifyRisk, requiresApproval } from "@/lib/agent/risk";

describe("agent risk policy", () => {
  it("requires approval for consequential actions", () => {
    expect(classifyRisk("submit application")).toBe("HIGH");
    expect(requiresApproval("HIGH")).toBe(true);
  });

  it("keeps read-only actions low risk", () => {
    expect(classifyRisk("extract job listings")).toBe("LOW");
    expect(requiresApproval("LOW")).toBe(false);
  });
});