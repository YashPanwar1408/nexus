import { describe, expect, it } from "vitest";
import { canRetry } from "@/lib/recovery/policy";
import { verifyExpectedOutcome } from "@/lib/verification/verify";

describe("verification", () => {
  it("requires observable evidence", () => expect(verifyExpectedOutcome("page contains internships", undefined).verified).toBe(false));
  it("reports supported evidence", () => expect(verifyExpectedOutcome("page contains internships", "The page contains internships").verified).toBe(true));
});

describe("recovery", () => {
  it("limits retries", () => { expect(canRetry(0)).toBe(true); expect(canRetry(2)).toBe(false); });
});
