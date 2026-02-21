import { Resend } from "resend";
import { z } from "zod";
import { EmailTemplate } from "@/components/email-template";

const FROM = "Admin <no-reply@thefoundersclub.tech>";

const sendEmailPayloadBaseSchema = z.object({
  leadName: z.string().trim().min(1, "Lead name is required."),
  leadEmail: z.email("Lead email is invalid."),
  teamName: z.string().trim().min(1, "Team name is required."),
  problemStatementId: z
    .string()
    .trim()
    .min(1, "Problem statement id is required."),
  problemStatementTitle: z
    .string()
    .trim()
    .min(1, "Problem statement title is required."),
  problemStatementSummary: z
    .string()
    .trim()
    .min(1, "Problem statement summary is required."),
  lockExpiresAtIso: z
    .string()
    .trim()
    .min(1, "Lock expiry timestamp is required."),
  lockedAtIso: z.string().trim().min(1, "Lock timestamp is required."),
});

const sendEmailPayloadSchema = z.discriminatedUnion("notificationType", [
  sendEmailPayloadBaseSchema.extend({
    notificationType: z.literal("lock_confirmed"),
  }),
  sendEmailPayloadBaseSchema.extend({
    abandonedAtIso: z.string().trim().min(1, "Abandon timestamp is required."),
    notificationType: z.literal("lock_abandoned"),
  }),
]);

const parseRequestJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const toProviderErrorMessage = (error: unknown) => {
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === "object") {
    const providerError = error as { message?: unknown; name?: unknown };
    if (
      typeof providerError.message === "string" &&
      providerError.message.trim().length > 0
    ) {
      return providerError.message;
    }

    if (
      typeof providerError.name === "string" &&
      providerError.name.trim().length > 0
    ) {
      return providerError.name;
    }
  }

  return "Email provider error";
};

const normalizeSiteUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

export async function POST(request: Request) {
  const body = await parseRequestJson(request);
  if (body === null) {
    return Response.json(
      {
        error: "Invalid JSON payload.",
        reason: "invalid_payload",
        sent: false,
      },
      { status: 400 },
    );
  }

  const parsed = sendEmailPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: parsed.error.issues[0]?.message ?? "Invalid payload.",
        reason: "invalid_payload",
        sent: false,
      },
      { status: 400 },
    );
  }

  const apiKey = process.env.FOUNDATHON_RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({
      reason: "missing_api_key",
      sent: false,
    });
  }

  const resend = new Resend(apiKey);
  const ctaBaseUrl =
    normalizeSiteUrl(process.env.SITE_URL ?? "") ??
    normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "");

  try {
    const subject =
      parsed.data.notificationType === "lock_abandoned"
        ? `Foundathon: Registration Abandoned - ${parsed.data.problemStatementTitle}`
        : `Foundathon: Problem Statement Locked - ${parsed.data.problemStatementTitle}`;

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [parsed.data.leadEmail],
      subject,
      react: EmailTemplate({
        abandonedAtIso:
          parsed.data.notificationType === "lock_abandoned"
            ? parsed.data.abandonedAtIso
            : undefined,
        ctaBaseUrl,
        leadEmail: parsed.data.leadEmail,
        leadName: parsed.data.leadName,
        lockExpiresAtIso: parsed.data.lockExpiresAtIso,
        lockedAtIso: parsed.data.lockedAtIso,
        notificationType: parsed.data.notificationType,
        problemStatementId: parsed.data.problemStatementId,
        problemStatementSummary: parsed.data.problemStatementSummary,
        problemStatementTitle: parsed.data.problemStatementTitle,
        teamName: parsed.data.teamName,
      }),
    });

    if (error) {
      const message = toProviderErrorMessage(error);
      console.error("Problem lock email provider error:", message);
      return Response.json({
        error: message,
        reason: "provider_error",
        sent: false,
      });
    }

    return Response.json({ id: data?.id, sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Problem lock email send failure:", message);
    return Response.json({
      error: message,
      reason: "provider_error",
      sent: false,
    });
  }
}
