export type DashboardEventOverview = {
  date: string;
  fee: string;
  registration: string;
  summary: string;
  title: string;
};

export type DashboardRuleSection = {
  id: string;
  items: string[];
  title: string;
};

export const DASHBOARD_EVENT_OVERVIEW: DashboardEventOverview = {
  date: "9th-11th March 2026",
  fee: "Selected teams may be required to pay a ₹300 participation fee.",
  registration:
    "First-come, first-served based on available problem-statement slots.",
  summary:
    "Open to undergraduate students; teams of 3-5 members must complete onboarding before locking one problem statement.",
  title: "Foundathon 3.0 - Rules & Guidelines",
};

export const DASHBOARD_EVENT_VENUES = [
  "BEL-605",
  "TP2-1401",
  "FabLab",
  "JC Bose Hall",
] as const;

export const DASHBOARD_QUICK_RULES = [
  "Open to undergraduate students; teams of 3-5 members must complete onboarding before locking one problem statement.",
  "Registration is first-come, first-served; selected teams may pay a ₹300 fee. Event dates: 9th-11th March 2026.",
  "Each team can choose only one problem statement (limited slots per track); changes require organizer approval.",
  "No plagiarism or cheating; only registered members can work on the project.",
  "Follow submission timelines strictly; late submissions will not be accepted.",
  "Winners may receive certificates, internships, or cash prizes; organizer decisions are final and rules may be modified if required.",
] as const;

export const DASHBOARD_RULE_SECTIONS: DashboardRuleSection[] = [
  {
    id: "eligibility",
    items: [
      "Open to all undergraduate students.",
      "Teams must have 3-5 members, including a team lead.",
      "All members must complete onboarding before locking a problem statement.",
    ],
    title: "Eligibility",
  },
  {
    id: "registration",
    items: [
      "Registration is first-come, first-served based on available problem-statement slots.",
      "Teams must register and lock one problem statement before creating the team officially.",
      "Selected teams may be required to pay a ₹300 participation fee.",
      "Event dates: 9th-11th March 2026.",
    ],
    title: "Registration",
  },
  {
    id: "problem-statement-rules",
    items: [
      "Each team can select only one problem statement.",
      "Each problem track has a fixed team cap.",
      "Once a problem statement is locked, it cannot be changed without organizer approval.",
    ],
    title: "Problem Statement Rules",
  },
  {
    id: "hackathon-conduct",
    items: [
      "Teams must work only with their registered members.",
      "Any plagiarism, cheating, or undisclosed copied solutions will lead to disqualification.",
      "Maintain respectful and professional behavior throughout the event.",
    ],
    title: "Hackathon Conduct",
  },
  {
    id: "development-guidelines",
    items: [
      "Open-source libraries are allowed with proper attribution.",
      "Teams should maintain documentation of their work.",
    ],
    title: "Development Guidelines",
  },
  {
    id: "submission-rules",
    items: [
      "Late submissions will not be accepted.",
    ],
    title: "Submission Rules",
  },
  {
    id: "rewards-certificates",
    items: [
      "Winners may receive certificates, internships, or cash prizes depending on partner tracks.",
      "Internship opportunities are subject to partner company policies.",
    ],
    title: "Rewards & Certificates",
  },
  {
    id: "organizer-rights",
    items: [
      "Founders Club reserves the right to modify rules, schedule, or problem statements if required.",
      "Organizer decisions will be final.",
    ],
    title: "Organizer Rights",
  },
  {
    id: "code-of-ethics",
    items: [
      "Respect mentors, judges, and fellow participants.",
      "Follow venue rules and event timelines.",
      "Any misconduct may lead to removal from the event.",
    ],
    title: "Code of Ethics",
  },
];
