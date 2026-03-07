import { Resend } from "resend";
import { getFoundathonResendApiKey, getFoundathonSiteUrl } from "@/server/env";

const DEFAULT_SITE_URL = "https://foundathon.thefoundersclub.tech";
const DEFAULT_FROM_EMAIL = "Foundathon 3.0 <no-reply@thefoundersclub.tech>";

export type TeamDecisionMailDecision = "accepted" | "rejected";

export type SendTeamDecisionMailInput = {
  decision: TeamDecisionMailDecision;
  problemStatementTitle: string | null;
  recipientEmail: string | null | undefined;
  teamId: string;
  teamName: string | null;
};

export type SendTeamDecisionMailResult =
  | {
      ok: true;
      recipient: string;
    }
  | {
      error: string;
      ok: false;
      recipient: string | null;
      status: number;
    };

const toTrimmedString = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const toNormalizedEmail = (value: string | null | undefined) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const isEmailLike = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const getMassMailFromEmail = () => {
  const configuredFromEmail = toTrimmedString(
    process.env.FOUNDATHON_RESEND_FROM_EMAIL,
  );
  return configuredFromEmail ?? DEFAULT_FROM_EMAIL;
};

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const getDecisionLabel = (decision: TeamDecisionMailDecision) =>
  decision === "accepted" ? "ACCEPTED" : "REJECTED";

const getDecisionTheme = (decision: TeamDecisionMailDecision) =>
  decision === "accepted"
    ? {
        accent: "#16A34A",
        accentSoft: "#EAF8F0",
        ctaLabel: "Open Team Dashboard",
        heroMessage:
          "Your team made it to the next round. Time to gear up and ship big.",
        heroTitle: "Entry Confirmed",
      }
    : {
        accent: "#DC2626",
        accentSoft: "#FEECEC",
        ctaLabel: "View Dashboard Updates",
        heroMessage:
          "Thank you for competing. This time your team was not selected for the next stage.",
        heroTitle: "Review Outcome",
      };

export const getTeamDecisionEmailContent = ({
  decision,
  problemStatementTitle,
  siteUrl,
  teamId,
  teamName,
}: {
  decision: TeamDecisionMailDecision;
  problemStatementTitle: string | null;
  siteUrl: string;
  teamId: string;
  teamName: string | null;
}) => {
  const normalizedSiteUrl = siteUrl.replace(/\/+$/, "");
  const dashboardUrl = `${normalizedSiteUrl}/dashboard/${encodeURIComponent(teamId)}`;
  const displayTeamName = teamName ?? "Foundathon Team";
  const displayProblemStatement = problemStatementTitle ?? "Not assigned";
  const escapedTeamName = escapeHtml(displayTeamName);
  const escapedProblemStatement = escapeHtml(displayProblemStatement);
  const decisionLabel = getDecisionLabel(decision);
  const theme = getDecisionTheme(decision);

  if (decision === "accepted") {
    const subject = "Foundathon 3.0 Update: Accepted for Final Round";
    const text = [
      `Hello ${displayTeamName},`,
      "",
      "Great news. Your team has been selected for the next round of Foundathon 3.0.",
      `Team Name: ${displayTeamName}`,
      `Problem Statement: ${displayProblemStatement}`,
      `Registration Status: ${decisionLabel}`,
      "",
      "Open your team dashboard and complete the INR 300 payment using the statement-specific UPI QR shown there.",
      "Submit both your Transaction ID / UTR and payment proof from the dashboard so the admin team can verify it.",
      "After payment is approved, look for the QR icon at the top-right of the Team Status card on your dashboard to open and download your Team Entrance ticket.",
      `Open your team dashboard here: ${dashboardUrl}`,
      "",
      "Regards,",
      "Foundathon Team",
    ].join("\n");

    const html = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F7FC;padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#FFFFFF;border:1px solid #DDE4EE;border-radius:18px;overflow:hidden;">
              <tr>
                <td style="padding:28px 30px;background:${theme.accentSoft};border-bottom:1px solid #DDE4EE;">
                  <div style="font-family:'Segoe UI',Arial,sans-serif;">
                    <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1.2px;font-weight:700;color:${theme.accent};text-transform:uppercase;">Foundathon 3.0 Decision</p>
                    <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.25;color:#0F172A;">${theme.heroTitle}</h1>
                    <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${theme.heroMessage}</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:30px;font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;line-height:1.65;">
                  <p style="margin:0 0 14px 0;font-size:16px;">Hello <strong>${escapedTeamName}</strong>,</p>
                  <p style="margin:0 0 20px 0;font-size:15px;color:#334155;">
                    Congratulations. Your team has been <strong>${decisionLabel}</strong> for Foundathon 3.0.
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px;font-size:14px;line-height:1.8;color:#1E293B;">
                        <strong>Team Name:</strong> ${escapedTeamName}<br />
                        <strong>Problem Statement:</strong> ${escapedProblemStatement}<br />
                        <strong>Registration Status:</strong> ${decisionLabel}
                      </td>
                    </tr>
                  </table>
                  <p style="margin:20px 0 0 0;font-size:15px;color:#334155;">
                    Open your dashboard and complete the <strong>INR 300 payment</strong> using the problem-statement-specific UPI QR shown there.
                  </p>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;background:#F8FAFC;border:1px solid #DCFCE7;border-radius:12px;">
                    <tr>
                      <td style="padding:16px 18px;font-size:14px;line-height:1.7;color:#1E293B;">
                        <strong>Next Step:</strong> Upload your <strong>Transaction ID / UTR</strong> and <strong>payment proof</strong> from the dashboard payment section after scanning the displayed UPI QR.
                      </td>
                    </tr>
                  </table>
                  <p style="margin:14px 0 0 0;font-size:15px;color:#334155;">
                    After payment is approved, look for the <strong>QR icon at the top-right of the Team Status card</strong> on your dashboard to open and download your <strong>Team Entrance ticket</strong>.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 30px 30px 30px;font-family:'Segoe UI',Arial,sans-serif;">
                  <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${theme.accent};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:10px;">
                    ${theme.ctaLabel}
                  </a>
                  <p style="margin:16px 0 0 0;font-size:12px;color:#64748B;">
                    If the button does not work, copy and open this link: ${dashboardUrl}
                  </p>
                  <p style="margin:20px 0 0 0;font-size:14px;color:#334155;">Regards,<br /><strong>Foundathon Team</strong></p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    return {
      html,
      subject,
      text,
    };
  }

  const subject = "Foundathon 3.0 Update: Submission Status - Rejected";
  const text = [
    `Hello ${displayTeamName},`,
    "",
    "Thank you for participating in Foundathon 3.0.",
    "After careful review, your team was not selected for the next round.",
    `Team Name: ${displayTeamName}`,
    `Problem Statement: ${displayProblemStatement}`,
    `Registration Status: ${decisionLabel}`,
    "",
    "We appreciate your effort and hope to see you in future editions.",
    `Open your team dashboard here: ${dashboardUrl}`,
    "",
    "Regards,",
    "Foundathon Team",
  ].join("\n");

  const html = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F3F7FC;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:680px;background:#FFFFFF;border:1px solid #DDE4EE;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 30px;background:${theme.accentSoft};border-bottom:1px solid #DDE4EE;">
                <div style="font-family:'Segoe UI',Arial,sans-serif;">
                  <p style="margin:0 0 8px 0;font-size:12px;letter-spacing:1.2px;font-weight:700;color:${theme.accent};text-transform:uppercase;">Foundathon 3.0 Decision</p>
                  <h1 style="margin:0 0 10px 0;font-size:28px;line-height:1.25;color:#0F172A;">${theme.heroTitle}</h1>
                  <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;">${theme.heroMessage}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;font-family:'Segoe UI',Arial,sans-serif;color:#0F172A;line-height:1.65;">
                <p style="margin:0 0 14px 0;font-size:16px;">Hello <strong>${escapedTeamName}</strong>,</p>
                <p style="margin:0 0 20px 0;font-size:15px;color:#334155;">
                  Thank you for competing in Foundathon 3.0. After review, your team is marked as
                  <strong>${decisionLabel}</strong> for this round.
                </p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;font-size:14px;line-height:1.8;color:#1E293B;">
                      <strong>Team Name:</strong> ${escapedTeamName}<br />
                      <strong>Problem Statement:</strong> ${escapedProblemStatement}<br />
                      <strong>Registration Status:</strong> ${decisionLabel}
                    </td>
                  </tr>
                </table>
                <p style="margin:20px 0 0 0;font-size:15px;color:#334155;">
                  We appreciate your effort and hope to see your team in upcoming editions.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 30px 30px 30px;font-family:'Segoe UI',Arial,sans-serif;">
                <a href="${dashboardUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:${theme.accent};color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:10px;">
                  ${theme.ctaLabel}
                </a>
                <p style="margin:16px 0 0 0;font-size:12px;color:#64748B;">
                  If the button does not work, copy and open this link: ${dashboardUrl}
                </p>
                <p style="margin:20px 0 0 0;font-size:14px;color:#334155;">Regards,<br /><strong>Foundathon Team</strong></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  return {
    html,
    subject,
    text,
  };
};

const fail = (
  error: string,
  recipient: string | null,
  status: number,
): SendTeamDecisionMailResult => ({
  error,
  ok: false,
  recipient,
  status,
});

export const sendTeamDecisionMail = async ({
  decision,
  problemStatementTitle,
  recipientEmail,
  teamId,
  teamName,
}: SendTeamDecisionMailInput): Promise<SendTeamDecisionMailResult> => {
  const resolvedRecipient = toNormalizedEmail(recipientEmail);
  if (!isEmailLike(resolvedRecipient)) {
    return fail(
      "Invalid recipient email address.",
      recipientEmail ?? null,
      400,
    );
  }

  const resendApiKey = getFoundathonResendApiKey();
  if (!resendApiKey) {
    return fail(
      "FOUNDATHON_RESEND_API_KEY is not configured for decision emails.",
      resolvedRecipient,
      500,
    );
  }

  const resend = new Resend(resendApiKey);
  const siteUrl = getFoundathonSiteUrl() ?? DEFAULT_SITE_URL;
  const from = getMassMailFromEmail();
  const { html, subject, text } = getTeamDecisionEmailContent({
    decision,
    problemStatementTitle,
    siteUrl,
    teamId,
    teamName,
  });

  try {
    const { error } = await resend.emails.send({
      from,
      html,
      subject,
      text,
      to: resolvedRecipient,
    });

    if (error) {
      return fail(
        error.message || "Failed to send decision email.",
        resolvedRecipient,
        502,
      );
    }

    return {
      ok: true,
      recipient: resolvedRecipient,
    };
  } catch (caughtError) {
    return fail(
      caughtError instanceof Error
        ? caughtError.message
        : "Failed to send decision email.",
      resolvedRecipient,
      502,
    );
  }
};
