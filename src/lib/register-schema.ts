import { z } from "zod";

const contactNumberSchema = z
  .number()
  .int("Contact must be an integer")
  .refine((val) => {
    const str = val.toString();
    return str.length === 10 && /^[6-9]/.test(str);
  }, {
    message: "Please enter a valid 10-digit mobile number.",
  });

export const srmMemberSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(50, "Name is too long."),
  raNumber: z
    .string()
    .trim()
    .regex(/^RA\d{13}$/, {
      message: "RA Number must start with 'RA' followed by 13 digits.",
    })
    .max(15),
  netId: z
    .string()
    .trim()
    .min(6, "NetID must be 6 characters long.")
    .max(6, "NetID must be 6 characters long.")
    .regex(/^[a-z]{2}[0-9]{4}$/, {
      message: "NetID must be 2 lowercase letters followed by 4 digits.",
    }),
  dept: z.string().trim().min(2, "Department is required."), // TODO: Maybe add a dropdown with common departments?
  contact: contactNumberSchema,
});

export const nonSrmMemberSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(50, "Name is too long."),
  collegeId: z.string().trim().min(2, "College ID Number is required."),
  collegeEmail: z.email("Valid college email is required."),
  contact: contactNumberSchema,
});

export const srmTeamSubmissionSchema = z
  .object({
    teamType: z.literal("srm"),
    teamName: z.string().trim().min(2, "Team Name is required."),
    lead: srmMemberSchema,
    members: z
      .array(srmMemberSchema)
      .min(2, "At least 2 members are required besides the lead.")
      .max(4, "Maximum 4 members are allowed besides the lead."),
  })
  .superRefine((data, ctx) => {
    const ids = [data.lead.netId, ...data.members.map((member) => member.netId)];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members"],
        message: "Each member must have a unique NetID.",
      });
    }
  });

export const nonSrmTeamSubmissionSchema = z
  .object({
    teamType: z.literal("non_srm"),
    teamName: z.string().trim().min(2, "Team Name is required."),
    collegeName: z.string().trim().min(2, "College Name is required."),
    isClub: z.boolean(),
    clubName: z.string().trim(),
    lead: nonSrmMemberSchema,
    members: z
      .array(nonSrmMemberSchema)
      .min(2, "At least 2 members are required besides the lead.")
      .max(4, "Maximum 4 members are allowed besides the lead."),
  })
  .superRefine((data, ctx) => {
    if (data.isClub && !data.clubName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clubName"],
        message: "Club Name is required when this team represents a club.",
      });
    }

    const ids = [data.lead.collegeId, ...data.members.map((member) => member.collegeId)];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["members"],
        message: "Each member must have a unique College ID Number.",
      });
    }
  });

export const teamSubmissionSchema = z.discriminatedUnion("teamType", [srmTeamSubmissionSchema, nonSrmTeamSubmissionSchema]);

export const teamRecordSchema = teamSubmissionSchema.and(
  z.object({
    id: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
);

export const teamRecordListSchema = z.array(teamRecordSchema);

export type SrmMember = z.infer<typeof srmMemberSchema>;
export type NonSrmMember = z.infer<typeof nonSrmMemberSchema>;
export type TeamSubmission = z.infer<typeof teamSubmissionSchema>;
export type TeamRecord = z.infer<typeof teamRecordSchema>;
