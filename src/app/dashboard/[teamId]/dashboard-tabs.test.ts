import { describe, expect, it } from "vitest";
import {
  buildDashboardTabUrl,
  DASHBOARD_DEFAULT_TAB,
  isDashboardTab,
  parseDashboardTab,
} from "./dashboard-tabs";

describe("dashboard tab helpers", () => {
  it("parses valid tab values", () => {
    expect(parseDashboardTab("overview")).toBe("overview");
    expect(parseDashboardTab("rules")).toBe("rules");
    expect(parseDashboardTab("manage")).toBe("manage");
    expect(parseDashboardTab("actions")).toBe("actions");
  });

  it("falls back to default tab when tab is invalid", () => {
    expect(parseDashboardTab("unknown")).toBe(DASHBOARD_DEFAULT_TAB);
    expect(parseDashboardTab("")).toBe(DASHBOARD_DEFAULT_TAB);
    expect(parseDashboardTab(null)).toBe(DASHBOARD_DEFAULT_TAB);
    expect(parseDashboardTab(undefined)).toBe(DASHBOARD_DEFAULT_TAB);
  });

  it("builds canonical dashboard tab url without created query", () => {
    const url = buildDashboardTabUrl({
      tab: "manage",
      teamId: "11111111-1111-4111-8111-111111111111",
    });

    expect(url).toBe(
      "/dashboard/11111111-1111-4111-8111-111111111111?tab=manage",
    );
  });

  it("builds dashboard tab url with optional created query", () => {
    const withCreated = buildDashboardTabUrl({
      created: "1",
      keepCreated: true,
      tab: "overview",
      teamId: "11111111-1111-4111-8111-111111111111",
    });

    const withoutCreated = buildDashboardTabUrl({
      created: "1",
      keepCreated: false,
      tab: "overview",
      teamId: "11111111-1111-4111-8111-111111111111",
    });

    expect(withCreated).toBe(
      "/dashboard/11111111-1111-4111-8111-111111111111?tab=overview&created=1",
    );
    expect(withoutCreated).toBe(
      "/dashboard/11111111-1111-4111-8111-111111111111?tab=overview",
    );
  });

  it("validates dashboard tab type guard", () => {
    expect(isDashboardTab("overview")).toBe(true);
    expect(isDashboardTab("rules")).toBe(true);
    expect(isDashboardTab("manage")).toBe(true);
    expect(isDashboardTab("actions")).toBe(true);
    expect(isDashboardTab("")).toBe(false);
    expect(isDashboardTab("overviews")).toBe(false);
    expect(isDashboardTab(null)).toBe(false);
  });
});
