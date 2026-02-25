export type DashboardRuleGroup = {
  description: string;
  id: string;
  items: string[];
  label: string;
};

export const DASHBOARD_RULE_GROUPS: DashboardRuleGroup[] = [
  {
    description:
      "How teams move from onboarding into the active dashboard lifecycle.",
    id: "event-flow",
    items: [
      "Each team must be linked to one locked problem statement.",
      "Problem statement lock is one-time and cannot be reassigned.",
      "Legacy teams without a lock must complete locking from the Manage Team tab.",
      "Any approval communication is sent to your lead email based on team type.",
    ],
    label: "Event Flow and Statement Lock",
  },
  {
    description:
      "Operational constraints enforced directly from this dashboard.",
    id: "dashboard-ops",
    items: [
      "PPT submission is one-time for each team and becomes view-only after upload.",
      "Only .ppt or .pptx files up to 5 MB are accepted.",
      "Team profile edits do not reset your locked statement or submitted PPT metadata.",
      "Destructive actions (team delete, lock, PPT submit) show irreversible warnings.",
    ],
    label: "Dashboard Operating Rules",
  },
];
