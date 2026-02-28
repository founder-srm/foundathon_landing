# Registration Stats API

## Purpose and scope

`GET /api/stats/registrations` provides aggregate registration analytics for Foundathon.

- No UI page is included.
- Response is structured for direct chart rendering and dashboard cards.
- Stats are scoped to current app event constants (`EVENT_ID`, `EVENT_TITLE`).

## Security

This endpoint is protected by API key header authentication.

- Header: `x-foundathon-stats-key: <FOUNDATHON_STATS_API_KEY>`
- Missing/invalid key: `401`
- Missing server key config: `500`

## Private stats page

Server-rendered page route:

- `/stats?key=<FOUNDATHON_STATS_PAGE_KEY>`

Behavior:

- Missing/invalid key returns `404` (page remains hidden).
- Page reads stats on the server (no API key exposed to browser JavaScript).

## Environment setup

Add these variables:

```env
FOUNDATHON_STATS_API_KEY=<strong-secret>
FOUNDATHON_STATS_EXCLUDED_EMAILS=<comma-separated-emails>
FOUNDATHON_STATS_PAGE_KEY=<private-page-key>
```

Exclusion behavior:

- `opdhaker2007@gmail.com` is always excluded by default.
- `FOUNDATHON_STATS_EXCLUDED_EMAILS` is merged with the default list.
- Email matching uses normalized `trim().toLowerCase()`.

## Request

```http
GET /api/stats/registrations
x-foundathon-stats-key: <secret>
```

No body. No query params in v1.

## Response schema

```ts
type RegistrationStatsResponse = {
  generatedAt: string;
  event: {
    eventId: string;
    eventTitle: string;
    statementCap: number;
    totalStatements: number;
    totalCapacity: number;
  };
  filters: {
    excludedRegistrationEmails: string[];
    excludedRows: number;
    includedRows: number;
  };

  requiredStats: {
    totalTeamsRegistered: number;
    rateOfFilling: {
      overallPercent: number;
      filledTeams: number;
      capacityTeams: number;
      remainingTeams: number;
    };
    registrationsPerProblemStatement: Array<{
      problemStatementId: string;
      title: string;
      registeredTeams: number;
      cap: number;
      remainingTeams: number;
      fillRatePercent: number;
      isFull: boolean;
    }>;
  };

  additionalStats: {
    teamTypeBreakdown: Array<{
      teamType: "srm" | "non_srm" | "unknown";
      teams: number;
      percent: number;
    }>;
    approvalStatusBreakdown: Array<{
      status: "accepted" | "rejected" | "submitted" | "invalid" | "not_reviewed";
      teams: number;
      percent: number;
    }>;
    presentationSubmission: {
      submittedTeams: number;
      pendingTeams: number;
      submissionRatePercent: number;
    };
    participation: {
      totalParticipants: number;
      averageTeamSize: number;
    };
    registrationTrendByDate: Array<{
      date: string;
      registrations: number;
    }>;
    anomalies: {
      missingProblemStatementId: number;
      unknownProblemStatementId: number;
      missingOrInvalidTeamType: number;
      missingOrInvalidTeamMembers: number;
    };
    firstRegistrationAt: string | null;
    lastRegistrationAt: string | null;
  };

  visualData: {
    cards: Array<{
      id:
        | "totalTeamsRegistered"
        | "overallFillRate"
        | "totalParticipants"
        | "avgTeamSize"
        | "pptSubmissionRate";
      label: string;
      value: number;
      unit: "teams" | "percent" | "participants" | "members_per_team";
    }>;
    charts: {
      registrationsPerProblemStatement: {
        chartType: "bar";
        labels: string[];
        series: Array<{ name: "Registrations" | "Capacity"; data: number[] }>;
      };
      fillRatePerProblemStatement: {
        chartType: "bar";
        labels: string[];
        series: Array<{ name: "Fill Rate %"; data: number[] }>;
      };
      registrationTrendByDate: {
        chartType: "line";
        labels: string[];
        series: Array<{ name: "Registrations"; data: number[] }>;
      };
      teamTypeDistribution: {
        chartType: "donut";
        labels: string[];
        series: Array<{ name: "Teams"; data: number[] }>;
      };
      approvalStatusDistribution: {
        chartType: "donut";
        labels: string[];
        series: Array<{ name: "Teams"; data: number[] }>;
      };
    };
  };
};
```

## Example success response (`200`)

```json
{
  "generatedAt": "2026-02-28T21:00:00.000Z",
  "event": {
    "eventId": "325b1472-4ce9-412f-8a5e-e4b7153064fa",
    "eventTitle": "Foundathon 3.0",
    "statementCap": 15,
    "totalStatements": 10,
    "totalCapacity": 150
  },
  "filters": {
    "excludedRegistrationEmails": ["opdhaker2007@gmail.com", "qa@example.com"],
    "excludedRows": 1,
    "includedRows": 34
  },
  "requiredStats": {
    "totalTeamsRegistered": 34,
    "rateOfFilling": {
      "overallPercent": 22.67,
      "filledTeams": 34,
      "capacityTeams": 150,
      "remainingTeams": 116
    },
    "registrationsPerProblemStatement": []
  },
  "additionalStats": {
    "teamTypeBreakdown": [],
    "approvalStatusBreakdown": [],
    "presentationSubmission": {
      "submittedTeams": 19,
      "pendingTeams": 15,
      "submissionRatePercent": 55.88
    },
    "participation": {
      "totalParticipants": 128,
      "averageTeamSize": 3.76
    },
    "registrationTrendByDate": [],
    "anomalies": {
      "missingProblemStatementId": 0,
      "unknownProblemStatementId": 0,
      "missingOrInvalidTeamType": 0,
      "missingOrInvalidTeamMembers": 0
    },
    "firstRegistrationAt": "2026-02-20T10:00:00.000Z",
    "lastRegistrationAt": "2026-02-27T17:30:00.000Z"
  },
  "visualData": {
    "cards": [],
    "charts": {
      "registrationsPerProblemStatement": {
        "chartType": "bar",
        "labels": [],
        "series": []
      },
      "fillRatePerProblemStatement": {
        "chartType": "bar",
        "labels": [],
        "series": []
      },
      "registrationTrendByDate": {
        "chartType": "line",
        "labels": [],
        "series": []
      },
      "teamTypeDistribution": {
        "chartType": "donut",
        "labels": [],
        "series": []
      },
      "approvalStatusDistribution": {
        "chartType": "donut",
        "labels": [],
        "series": []
      }
    }
  }
}
```

## Metric definitions

- `registrationsPerProblemStatement`: team count per known statement id, with cap and remaining capacity.
- `rateOfFilling.overallPercent`: `(filledTeams / capacityTeams) * 100`, rounded to 2 decimals.
- `filledTeams`: sum of registrations assigned to known problem statements.
- `totalTeamsRegistered`: all included rows after exclusion filter.
- `teamTypeBreakdown`: distribution across `srm`, `non_srm`, and `unknown`.
- `approvalStatusBreakdown`: normalized `is_approved` status distribution; unknown/empty values map to `not_reviewed`.
- `presentationSubmission`: submission inferred from stored presentation metadata.
- `participation.totalParticipants`: lead + valid members count aggregated across teams.
- `registrationTrendByDate`: UTC date bucket from `created_at`.
- `anomalies`: counters for malformed or missing registration details.
