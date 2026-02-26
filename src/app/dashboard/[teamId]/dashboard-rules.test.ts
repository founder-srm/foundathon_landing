import { describe, expect, it } from "vitest";
import {
  DASHBOARD_EVENT_VENUES,
  DASHBOARD_QUICK_RULES,
  DASHBOARD_RULE_SECTIONS,
} from "./dashboard-rules";

describe("dashboard event details content", () => {
  it("includes all event venues", () => {
    expect(DASHBOARD_EVENT_VENUES).toHaveLength(4);
    expect(DASHBOARD_EVENT_VENUES).toEqual(
      expect.arrayContaining(["BEL-605", "TP2-1401", "FabLab", "JC Bose Hall"]),
    );
  });

  it("includes six quick rule summaries", () => {
    expect(DASHBOARD_QUICK_RULES).toHaveLength(6);
  });

  it("keeps nine ordered detailed rule sections", () => {
    expect(DASHBOARD_RULE_SECTIONS).toHaveLength(9);
    expect(DASHBOARD_RULE_SECTIONS.map((section) => section.title)).toEqual([
      "Eligibility",
      "Registration",
      "Problem Statement Rules",
      "Hackathon Conduct",
      "Development Guidelines",
      "Submission Rules",
      "Rewards & Certificates",
      "Organizer Rights",
      "Code of Ethics",
    ]);
  });
});
