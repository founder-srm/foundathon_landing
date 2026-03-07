import { describe, expect, it } from "vitest";
import {
  toTeamRecord,
  withSrmEmailNetIds,
} from "@/server/registration/mappers";

const baseRow = {
  id: "11111111-1111-4111-8111-111111111111",
  created_at: "2026-02-20T10:00:00.000Z",
  details: {
    teamType: "srm",
    teamName: "Pitch Pioneers",
    lead: {
      name: "Lead",
      raNumber: "RA0000000000001",
      netId: "od7270@srmist.edu.in",
      dept: "CSE",
      contact: 9876543210,
    },
    members: [
      {
        name: "M1",
        raNumber: "RA0000000000002",
        netId: "ab1234@srmist.edu.in",
        dept: "CSE",
        contact: 9876543211,
      },
      {
        name: "M2",
        raNumber: "RA0000000000003",
        netId: "cd5678@srmist.edu.in",
        dept: "ECE",
        contact: 9876543212,
      },
    ],
  },
  updated_at: "2026-02-20T10:05:00.000Z",
} as const;

describe("toTeamRecord", () => {
  it("maps presentation metadata from details", () => {
    const team = toTeamRecord({
      ...baseRow,
      details: {
        ...baseRow.details,
        presentationFileName: "team-deck.pptx",
        presentationFileSizeBytes: 1024,
        presentationMimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        presentationPublicUrl: "https://example.com/public/team-deck.pptx",
        presentationStoragePath: "registrations/team-id/submission.pptx",
        presentationUploadedAt: "2026-02-20T10:05:00.000Z",
      },
    });

    expect(team).not.toBeNull();
    expect(team?.teamType).toBe("srm");
    if (!team || team.teamType !== "srm") {
      throw new Error("Expected an SRM team record.");
    }
    expect(team.lead.netId).toBe("od7270");
    expect(team?.presentationPublicUrl).toBe(
      "https://example.com/public/team-deck.pptx",
    );
    expect(team?.presentationFileName).toBe("team-deck.pptx");
    expect(team?.presentationFileSizeBytes).toBe(1024);
  });

  it("maps payment metadata from details", () => {
    const team = toTeamRecord({
      ...baseRow,
      details: {
        ...baseRow.details,
        paymentProofFileName: "proof.png",
        paymentProofFileSizeBytes: 2048,
        paymentProofMimeType: "image/png",
        paymentProofStoragePath: "payment-proofs/user/team-id/proof.png",
        paymentRejectedReason: "Mismatch in screenshot",
        paymentReviewedAt: "2026-02-20T10:10:00.000Z",
        paymentStatus: "rejected",
        paymentSubmittedAt: "2026-02-20T10:06:00.000Z",
        paymentUtr: "UTR123456789",
      },
    });

    expect(team).not.toBeNull();
    expect(team?.paymentStatus).toBe("rejected");
    expect(team?.paymentUtr).toBe("UTR123456789");
    expect(team?.paymentRejectedReason).toBe("Mismatch in screenshot");
    expect(team?.paymentProofFileName).toBe("proof.png");
    expect(team?.paymentProofFileSizeBytes).toBe(2048);
  });

  it("drops invalid presentation metadata values", () => {
    const team = toTeamRecord({
      ...baseRow,
      details: {
        ...baseRow.details,
        presentationFileName: "   ",
        presentationFileSizeBytes: -1,
        presentationMimeType: "",
        presentationPublicUrl: "",
      },
    });

    expect(team).not.toBeNull();
    expect(team).not.toHaveProperty("presentationPublicUrl");
    expect(team).not.toHaveProperty("presentationMimeType");
    expect(team).not.toHaveProperty("presentationFileSizeBytes");
  });

  it("drops invalid payment metadata values", () => {
    const team = toTeamRecord({
      ...baseRow,
      details: {
        ...baseRow.details,
        paymentProofFileName: "   ",
        paymentProofFileSizeBytes: -1,
        paymentProofMimeType: "",
        paymentProofStoragePath: "",
        paymentRejectedReason: "",
        paymentReviewedAt: "",
        paymentStatus: "bad_status",
        paymentSubmittedAt: "",
        paymentUtr: "123",
      },
    });

    expect(team).not.toBeNull();
    expect(team).not.toHaveProperty("paymentStatus");
    expect(team).not.toHaveProperty("paymentUtr");
    expect(team).not.toHaveProperty("paymentProofStoragePath");
    expect(team).not.toHaveProperty("paymentProofFileSizeBytes");
  });

  it("maps approval status from database enum value", () => {
    const team = toTeamRecord({
      ...baseRow,
      is_approved: "Submitted",
    });

    expect(team).not.toBeNull();
    expect(team?.approvalStatus).toBe("submitted");
  });
});

describe("withSrmEmailNetIds", () => {
  it("normalizes SRM department values to uppercase", () => {
    const normalized = withSrmEmailNetIds({
      teamType: "srm",
      teamName: "Pitch Pioneers",
      lead: {
        name: "Lead",
        raNumber: "RA0000000000001",
        netId: "od7270",
        dept: "cse ai",
        contact: 9876543210,
      },
      members: [
        {
          name: "M1",
          raNumber: "RA0000000000002",
          netId: "ab1234",
          dept: "ece",
          contact: 9876543211,
        },
        {
          name: "M2",
          raNumber: "RA0000000000003",
          netId: "cd5678",
          dept: "mech ",
          contact: 9876543212,
        },
      ],
    });

    expect(normalized.teamType).toBe("srm");
    if (normalized.teamType !== "srm") {
      throw new Error("Expected SRM team submission.");
    }

    expect(normalized.lead.dept).toBe("CSE AI");
    expect(normalized.members[0]?.dept).toBe("ECE");
    expect(normalized.members[1]?.dept).toBe("MECH");
  });
});
