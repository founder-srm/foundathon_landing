import { describe, expect, it } from "vitest";
import { teamRecordSchema, teamSubmissionSchema } from "@/lib/register-schema";

describe("teamSubmissionSchema", () => {
  it("accepts valid SRM payload with team name", () => {
    const parsed = teamSubmissionSchema.safeParse({
      teamType: "srm",
      teamName: "Board Breakers",
      lead: {
        name: "Lead One",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "CSE",
        contact: 9876543210,
      },
      members: [
        {
          name: "Member One",
          raNumber: "RA0000000000002",
          netId: "ab1234",
          dept: "CSE",
          contact: 9876543211,
        },
        {
          name: "Member Two",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "ECE",
          contact: 9876543212,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects SRM payload when team name is missing", () => {
    const parsed = teamSubmissionSchema.safeParse({
      teamType: "srm",
      teamName: "",
      lead: {
        name: "Lead One",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "CSE",
        contact: 9876543210,
      },
      members: [
        {
          name: "Member One",
          raNumber: "RA0000000000002",
          netId: "ab1234",
          dept: "CSE",
          contact: 9876543211,
        },
        {
          name: "Member Two",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "ECE",
          contact: 9876543212,
        },
      ],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toBe("Team Name is required.");
    }
  });

  it("rejects non-SRM payload when club flag is true and club name is missing", () => {
    const parsed = teamSubmissionSchema.safeParse({
      teamType: "non_srm",
      teamName: "Pitch Panthers",
      collegeName: "ABC College",
      isClub: true,
      clubName: "",
      lead: {
        name: "Lead Two",
        collegeId: "NID123",
        collegeEmail: "lead@abc.edu",
        contact: 8765432109,
      },
      members: [
        {
          name: "Member A",
          collegeId: "NID124",
          collegeEmail: "a@abc.edu",
          contact: 8765432108,
        },
        {
          name: "Member B",
          collegeId: "NID125",
          collegeEmail: "b@abc.edu",
          contact: 8765432107,
        },
      ],
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(
        parsed.error.issues.some((issue) => issue.path[0] === "clubName"),
      ).toBe(true);
    }
  });

  it("rejects SRM payload when NetID is duplicated", () => {
    const parsed = teamSubmissionSchema.safeParse({
      teamType: "srm",
      teamName: "Board Breakers",
      lead: {
        name: "Lead One",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "CSE",
        contact: 9876543210,
      },
      members: [
        {
          name: "Member One",
          raNumber: "RA0000000000002",
          netId: "od7270",
          dept: "CSE",
          contact: 9876543211,
        },
        {
          name: "Member Two",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "ECE",
          contact: 9876543212,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects non-SRM payload when College ID is duplicated", () => {
    const parsed = teamSubmissionSchema.safeParse({
      teamType: "non_srm",
      teamName: "Pitch Panthers",
      collegeName: "ABC College",
      isClub: false,
      clubName: "",
      lead: {
        name: "Lead Two",
        collegeId: "NID123",
        collegeEmail: "lead@abc.edu",
        contact: 8765432109,
      },
      members: [
        {
          name: "Member A",
          collegeId: "NID123",
          collegeEmail: "a@abc.edu",
          contact: 8765432108,
        },
        {
          name: "Member B",
          collegeId: "NID125",
          collegeEmail: "b@abc.edu",
          contact: 8765432107,
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("teamRecordSchema", () => {
  it("accepts team record payload with presentation metadata", () => {
    const parsed = teamRecordSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-20T10:05:00.000Z",
      teamType: "srm",
      teamName: "Board Breakers",
      lead: {
        name: "Lead One",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "CSE",
        contact: 9876543210,
      },
      members: [
        {
          name: "Member One",
          raNumber: "RA0000000000002",
          netId: "ab1234",
          dept: "CSE",
          contact: 9876543211,
        },
        {
          name: "Member Two",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "ECE",
          contact: 9876543212,
        },
      ],
      problemStatementCap: 10,
      problemStatementId: "ps-01",
      problemStatementLockedAt: "2026-02-19T08:00:00.000Z",
      problemStatementTitle: "Campus Mobility Optimizer",
      approvalStatus: "submitted",
      presentationFileName: "team-deck.pptx",
      presentationFileSizeBytes: 1024,
      presentationMimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      presentationPublicUrl: "https://example.com/public/team-deck.pptx",
      presentationStoragePath: "registrations/team-id/submission.pptx",
      presentationUploadedAt: "2026-02-20T10:05:00.000Z",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid presentation metadata values", () => {
    const parsed = teamRecordSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-20T10:05:00.000Z",
      teamType: "srm",
      teamName: "Board Breakers",
      lead: {
        name: "Lead One",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "CSE",
        contact: 9876543210,
      },
      members: [
        {
          name: "Member One",
          raNumber: "RA0000000000002",
          netId: "ab1234",
          dept: "CSE",
          contact: 9876543211,
        },
        {
          name: "Member Two",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "ECE",
          contact: 9876543212,
        },
      ],
      presentationFileSizeBytes: 0,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects invalid approval status values", () => {
    const parsed = teamRecordSchema.safeParse({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2026-02-20T10:00:00.000Z",
      updatedAt: "2026-02-20T10:05:00.000Z",
      teamType: "srm",
      teamName: "Board Breakers",
      lead: {
        name: "Lead One",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "CSE",
        contact: 9876543210,
      },
      members: [
        {
          name: "Member One",
          raNumber: "RA0000000000002",
          netId: "ab1234",
          dept: "CSE",
          contact: 9876543211,
        },
        {
          name: "Member Two",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "ECE",
          contact: 9876543212,
        },
      ],
      approvalStatus: "pending",
    });

    expect(parsed.success).toBe(false);
  });
});
