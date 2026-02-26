export type DashboardTab = "overview" | "rules" | "manage" | "actions";

export type DashboardTabConfig = {
  description: string;
  id: DashboardTab;
  label: string;
};

export const DASHBOARD_DEFAULT_TAB: DashboardTab = "overview";

export const DASHBOARD_TABS: DashboardTabConfig[] = [
  {
    description: "Team status, health, and next actions.",
    id: "overview",
    label: "Team Overview",
  },
  {
    description: "Event schedule, venues, and participation guidelines.",
    id: "rules",
    label: "Event Details",
  },
  {
    description: "Edit roster and complete legacy lock tasks.",
    id: "manage",
    label: "Manage Team",
  },
  {
    description: "Submit and manage your one-time team presentation.",
    id: "actions",
    label: "PPT Submission",
  },
];

const DASHBOARD_TAB_SET = new Set<DashboardTab>(
  DASHBOARD_TABS.map((tab) => tab.id),
);

export const isDashboardTab = (
  value: string | null | undefined,
): value is DashboardTab =>
  typeof value === "string" && DASHBOARD_TAB_SET.has(value as DashboardTab);

export const parseDashboardTab = (
  value: string | null | undefined,
): DashboardTab => (isDashboardTab(value) ? value : DASHBOARD_DEFAULT_TAB);

export const buildDashboardTabUrl = ({
  created,
  keepCreated = false,
  tab,
  teamId,
}: {
  created?: string | null;
  keepCreated?: boolean;
  tab: string | null | undefined;
  teamId: string;
}) => {
  const params = new URLSearchParams();
  params.set("tab", parseDashboardTab(tab));
  if (keepCreated && created === "1") {
    params.set("created", "1");
  }

  return `/dashboard/${teamId}?${params.toString()}`;
};
