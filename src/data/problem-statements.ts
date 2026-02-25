export const PROBLEM_STATEMENT_CAP = 15;

export type ProblemStatement = {
  id: string;
  summary: string;
  title: string;
};

export const PROBLEM_STATEMENTS: ProblemStatement[] = [
  {
    id: "ps-01",
    title: "Localized Government Scheme Discovery Portal",
    summary:
      "A significant information gap prevents rural populations from accessing crucial government schemes, welfare programs, and subsidies. There is a need for an accessible, localized solution that simplifies scheme discovery and eligibility checking for citizens with varying levels of digital literacy.",
  },
  {
    id: "ps-02",
    title: "Direct-to-Consumer E-Commerce Platform for Rural Artisans",
    summary:
      "Rural artisans and micro-entrepreneurs struggle to reach broader markets due to limited marketing knowledge, poor digital presence, and supply chain barriers. A dedicated platform or tool is required to help them build digital storefronts, enhance product visibility, and connect directly with urban consumers.",
  },
  {
    id: "ps-03",
    title: "Localized AI Skills Training Platform for Rural Communities",
    summary:
      "The rapid advancement of artificial intelligence threatens to widen the digital divide for rural communities who lack access to cutting-edge tech education. Creating localized, easy-to-understand educational modules can empower rural students and workers to leverage AI tools for agriculture, education, and daily problem-solving.",
  },
  {
    id: "ps-04",
    title: "AI Matchmaking for Cross-Industry Innovation",
    summary:
      "Groundbreaking solutions are often lost because experts like engineers and surgeons rarely interact outside their own domains. The challenge requires building an AI-driven networking platform that actively matches professionals from distinct disciplines, translates their domain-specific jargon, and facilitates direct collaboration to solve complex, overlapping problems.",
  },
  {
    id: "ps-05",
    title: "Hostel Mess Food Wastage Tracker & Analytics Dashboard",
    summary:
      "Hostel messes lack tracking systems to monitor inefficiencies and dietary preferences, leading to significant resource loss. This application aggregates daily wastage data across multiple facilities, using analytics to generate actionable insights—such as correlating high waste with specific menus—to optimize food quality and reduce environmental impact.",
  },
  {
    id: "ps-06",
    title: "Lifecycle Management Platform for Environmental Credits",
    summary:
      "Current environmental credit markets suffer from fragmented, opaque, and inefficient digital infrastructures that hinder trust and scalability. This challenge requires designing a secure, transparent platform to manage the complete lifecycle of environmental assets—from issuance to retirement—ensuring traceability, automated reconciliation, and strict auditability.",
  },
  {
    id: "ps-07",
    title: "Real-Time Location-Based Animal Rescue Dispatch App",
    summary:
      "Animal rescue efforts are currently unstructured and fragmented, leading to delayed responses and uncoordinated care. This location-aware dispatch system functions like a mobility app for animal safety, seamlessly connecting citizens, NGOs, and veterinarians for real-time reporting, live tracking, and transparent rehabilitation.",
  },
  {
    id: "ps-08",
    title: "Secure Online Listening and Empathy Training Platform",
    summary:
      "People often lack safe, structured digital spaces for emotional ventilation and empathetic dialogue. This secure, multilingual platform bridges that gap by providing guided listening circles, real-time communication channels, and a certified training curriculum to cultivate active listening and community resilience.",
  },
  {
    id: "ps-09",
    title: "AI-Driven Climate Tech Investment and Funding Platform",
    summary:
      "Climate innovators and investors often struggle to connect efficiently, slowing down the funding and deployment of vital green technologies. This digital marketplace leverages AI and data analytics to streamline project evaluation, risk assessment, and transparent financial tracking, accelerating the scalability of climate-focused startups.",
  },
  {
    id: "ps-10",
    title: "AI-Powered Ecosystem & Biodiversity Monitoring Platform",
    summary:
      "Conservationists and policymakers often lack integrated tools to predict and mitigate complex environmental and biodiversity threats in real-time. This scientific intelligence platform leverages AI, IoT sensors, and satellite data to aggregate ecosystem metrics, enabling data-driven decisions for planetary sustainability and cultural heritage protection.",
  },
];

const statementMap = new Map(PROBLEM_STATEMENTS.map((item) => [item.id, item]));

export const getProblemStatementById = (problemStatementId: string) =>
  statementMap.get(problemStatementId) ?? null;
