import { describe, expect, it } from "vitest";
import {
  findProblemStatementSummary,
  isValidEmailAddress,
  LOCK_EMAIL_SUMMARY_FALLBACK,
  toSrmLeadEmail,
} from "@/lib/problem-lock-email";

describe("problem lock email helpers", () => {
  it("normalizes SRM lead email from netId", () => {
    expect(toSrmLeadEmail("OD7270")).toBe("od7270@srmist.edu.in");
    expect(toSrmLeadEmail("ab1234@srmist.edu.in")).toBe("ab1234@srmist.edu.in");
  });

  it("validates email addresses", () => {
    expect(isValidEmailAddress("lead@example.com")).toBe(true);
    expect(isValidEmailAddress("bad-email")).toBe(false);
  });

  it("finds statement summary and falls back when missing", () => {
    const statements = [
      { id: "ps-01", summary: "Summary A" },
      { id: "ps-02", summary: "Summary B" },
    ];

    expect(findProblemStatementSummary(statements, "ps-02")).toBe("Summary B");
    expect(findProblemStatementSummary(statements, "ps-99")).toBe(
      LOCK_EMAIL_SUMMARY_FALLBACK,
    );
  });
});
