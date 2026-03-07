"use client";

import { ExternalLink, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import PresentationPreviewModal from "@/components/presentation/presentation-preview-modal";
import { FnButton } from "@/components/ui/fn-button";
import { PROBLEM_STATEMENTS } from "@/data/problem-statements";
import { toast } from "@/hooks/use-toast";

type AdminReviewStatementFilter =
  | "all"
  | (typeof PROBLEM_STATEMENTS)[number]["id"];
type AdminReviewApprovalStatus = "accepted" | "rejected" | "submitted";

type AdminReviewTab = {
  count: number;
  id: string;
  label: string;
};

type AdminReviewSubmissionTeam = {
  approvalStatus: AdminReviewApprovalStatus;
  id: string;
  leadName: string;
  presentationFileName: string;
  presentationPublicUrl: string;
  presentationUploadedAt: string;
  problemStatementId: string | null;
  problemStatementTitle: string | null;
  registrationEmail: string;
  teamName: string;
};

type AdminReviewSubmissionsResponse = {
  statement: AdminReviewStatementFilter;
  tabs: AdminReviewTab[];
  teams: AdminReviewSubmissionTeam[];
};

type AdminPaymentProofStatus =
  | "not_submitted"
  | "submitted"
  | "approved"
  | "rejected";

type AdminPaymentProofTeam = {
  id: string;
  leadName: string;
  paymentRejectedReason: string | null;
  paymentReviewedAt: string | null;
  paymentStatus: AdminPaymentProofStatus;
  paymentSubmittedAt: string | null;
  paymentUtr: string | null;
  problemStatementId: string | null;
  problemStatementTitle: string | null;
  registrationEmail: string;
  teamName: string;
};

type AdminPaymentProofsResponse = {
  statement: AdminReviewStatementFilter;
  teams: AdminPaymentProofTeam[];
};

export type TeamSubmissionStatus = "submitted" | "non_submitted";

export type AdminTeamContactRow = {
  id: string;
  leadPhone: string | null;
  memberPhones: string[];
  problemStatementNumber: string | null;
  problemStatementTitle: string | null;
  submissionStatus: TeamSubmissionStatus;
  teamName: string;
};

type DecisionApiResponse = {
  approvalStatus: "accepted" | "rejected";
  mail: {
    error?: string;
    recipient: string | null;
    sent: boolean;
  };
  teamId: string;
};

type PaymentDecisionApiResponse = {
  paymentRejectedReason: string | null;
  paymentReviewedAt: string | null;
  paymentStatus: "approved" | "rejected";
  teamId: string;
};

type AdminReviewClientProps = {
  adminEmail: string;
  initialTeamContacts: AdminTeamContactRow[];
};

type SubmissionFilter = "all" | TeamSubmissionStatus;
type SubmissionSortOrder = "submitted_first" | "non_submitted_first";
type AdminSectionId = "review-queues" | "payment-review" | "contact-directory";
type AdminSectionNavItem = {
  count: number;
  description: string;
  id: AdminSectionId;
  label: string;
  tone: "blue" | "green" | "orange";
};

const ALL_STATEMENTS = ["all", ...PROBLEM_STATEMENTS.map((item) => item.id)];
const CONTACT_EXPORT_COLUMNS = [
  "Team Name",
  "Problem Statement Number",
  "Problem Statement",
  "Lead Phone Number",
  "Team Member Phone Numbers",
  "Submission Status",
] as const;

const DEFAULT_TABS: AdminReviewTab[] = [
  {
    count: 0,
    id: "all",
    label: "All",
  },
  ...PROBLEM_STATEMENTS.map((statement) => ({
    count: 0,
    id: statement.id,
    label: statement.id.toUpperCase(),
  })),
];

const toStatusMeta = (status: AdminReviewApprovalStatus) => {
  switch (status) {
    case "accepted":
      return {
        badgeClass: "border-fngreen/40 bg-fngreen/10 text-fngreen",
        label: "Accepted",
      };
    case "rejected":
      return {
        badgeClass: "border-fnred/40 bg-fnred/10 text-fnred",
        label: "Rejected",
      };
    default:
      return {
        badgeClass: "border-fnblue/40 bg-fnblue/10 text-fnblue",
        label: "Submitted",
      };
  }
};

const toPaymentStatusMeta = (status: AdminPaymentProofStatus) => {
  switch (status) {
    case "submitted":
      return {
        badgeClass: "border-fnblue/40 bg-fnblue/10 text-fnblue",
        label: "Under Review",
      };
    case "approved":
      return {
        badgeClass: "border-fngreen/40 bg-fngreen/10 text-fngreen",
        label: "Approved",
      };
    case "rejected":
      return {
        badgeClass: "border-fnred/40 bg-fnred/10 text-fnred",
        label: "Rejected",
      };
    default:
      return {
        badgeClass: "border-fnorange/40 bg-fnorange/10 text-fnorange",
        label: "Not Submitted",
      };
  }
};

const toDisplayDateTime = (value: string) => {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });
};

const toCsvCell = (value: number | string | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized = String(value);
  if (
    normalized.includes(",") ||
    normalized.includes('"') ||
    normalized.includes("\n")
  ) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
};

const toCsv = ({
  columns,
  rows,
}: {
  columns: readonly string[];
  rows: Array<Record<string, number | string | null>>;
}) => {
  const header = columns.map((column) => toCsvCell(column)).join(",");
  const dataRows = rows.map((row) =>
    columns.map((column) => toCsvCell(row[column])).join(","),
  );

  return [header, ...dataRows].join("\n");
};

const toSubmissionStatusLabel = (value: TeamSubmissionStatus) =>
  value === "submitted" ? "Submitted" : "Non-submitted";

const toSubmissionStatusSortRank = ({
  sortOrder,
  status,
}: {
  sortOrder: SubmissionSortOrder;
  status: TeamSubmissionStatus;
}) => {
  if (sortOrder === "submitted_first") {
    return status === "submitted" ? 0 : 1;
  }

  return status === "non_submitted" ? 0 : 1;
};

const isStatementFilter = (
  value: string,
): value is AdminReviewStatementFilter => ALL_STATEMENTS.includes(value);

export default function AdminReviewClient({
  adminEmail,
  initialTeamContacts,
}: AdminReviewClientProps) {
  const [activeStatement, setActiveStatement] =
    useState<AdminReviewStatementFilter>("all");
  const [tabs, setTabs] = useState<AdminReviewTab[]>(DEFAULT_TABS);
  const [teams, setTeams] = useState<AdminReviewSubmissionTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [paymentTeams, setPaymentTeams] = useState<AdminPaymentProofTeam[]>([]);
  const [isPaymentLoading, setIsPaymentLoading] = useState(true);
  const [paymentFetchError, setPaymentFetchError] = useState("");
  const [pendingDecision, setPendingDecision] = useState<{
    decision: "accepted" | "rejected";
    teamId: string;
  } | null>(null);
  const [pendingPaymentDecision, setPendingPaymentDecision] = useState<{
    decision: "approved" | "rejected";
    teamId: string;
  } | null>(null);
  const [paymentRejectionReasons, setPaymentRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [previewTeam, setPreviewTeam] =
    useState<AdminReviewSubmissionTeam | null>(null);
  const [submissionFilter, setSubmissionFilter] =
    useState<SubmissionFilter>("all");
  const [submissionSortOrder, setSubmissionSortOrder] =
    useState<SubmissionSortOrder>("non_submitted_first");
  const [activeSection, setActiveSection] =
    useState<AdminSectionId>("review-queues");

  const submittedCount = useMemo(
    () =>
      initialTeamContacts.filter(
        (team) => team.submissionStatus === "submitted",
      ).length,
    [initialTeamContacts],
  );
  const nonSubmittedCount = useMemo(
    () =>
      initialTeamContacts.filter(
        (team) => team.submissionStatus === "non_submitted",
      ).length,
    [initialTeamContacts],
  );

  const filteredAndSortedTeamContacts = useMemo(() => {
    const filteredContacts =
      submissionFilter === "all"
        ? initialTeamContacts
        : initialTeamContacts.filter(
            (team) => team.submissionStatus === submissionFilter,
          );

    return [...filteredContacts].sort((left, right) => {
      const submissionRankDifference =
        toSubmissionStatusSortRank({
          sortOrder: submissionSortOrder,
          status: left.submissionStatus,
        }) -
        toSubmissionStatusSortRank({
          sortOrder: submissionSortOrder,
          status: right.submissionStatus,
        });
      if (submissionRankDifference !== 0) {
        return submissionRankDifference;
      }

      const statementCompare = (
        left.problemStatementNumber ?? ""
      ).localeCompare(right.problemStatementNumber ?? "", undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (statementCompare !== 0) {
        return statementCompare;
      }

      return left.teamName.localeCompare(right.teamName, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [initialTeamContacts, submissionFilter, submissionSortOrder]);

  const fetchTeams = useCallback(
    async ({
      showErrorToast,
      statement,
    }: {
      showErrorToast?: boolean;
      statement: AdminReviewStatementFilter;
    }) => {
      setIsLoading(true);
      setFetchError("");

      try {
        const response = await fetch(
          `/api/admin/review-submissions?statement=${encodeURIComponent(
            statement,
          )}`,
        );
        const data = (await response.json().catch(() => null)) as
          | AdminReviewSubmissionsResponse
          | {
              error?: string;
            }
          | null;

        if (!response.ok || !data || !("teams" in data) || !("tabs" in data)) {
          const error =
            data && "error" in data && typeof data.error === "string"
              ? data.error
              : "Could not load submitted teams.";
          setFetchError(error);
          setTeams([]);
          setTabs(DEFAULT_TABS);

          if (showErrorToast) {
            toast({
              title: "Failed to Load Teams",
              description: error,
              variant: "destructive",
            });
          }
          return;
        }

        setTeams(data.teams);
        setTabs(data.tabs.length > 0 ? data.tabs : DEFAULT_TABS);
      } catch {
        const error = "Network issue while loading submitted teams.";
        setFetchError(error);
        setTeams([]);
        setTabs(DEFAULT_TABS);

        if (showErrorToast) {
          toast({
            title: "Network Error",
            description: error,
            variant: "destructive",
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const fetchPaymentTeams = useCallback(
    async ({
      showErrorToast,
      statement,
    }: {
      showErrorToast?: boolean;
      statement: AdminReviewStatementFilter;
    }) => {
      setIsPaymentLoading(true);
      setPaymentFetchError("");

      try {
        const response = await fetch(
          `/api/admin/payment-proofs?statement=${encodeURIComponent(statement)}`,
        );
        const data = (await response.json().catch(() => null)) as
          | AdminPaymentProofsResponse
          | {
              error?: string;
            }
          | null;

        if (!response.ok || !data || !("teams" in data)) {
          const error =
            data && "error" in data && typeof data.error === "string"
              ? data.error
              : "Could not load payment proofs.";
          setPaymentFetchError(error);
          setPaymentTeams([]);

          if (showErrorToast) {
            toast({
              title: "Failed to Load Payment Queue",
              description: error,
              variant: "destructive",
            });
          }
          return;
        }

        setPaymentTeams(data.teams);
        setPaymentRejectionReasons((current) => {
          const next = { ...current };
          for (const team of data.teams) {
            if (team.paymentRejectedReason && !next[team.id]?.trim().length) {
              next[team.id] = team.paymentRejectedReason;
            }
          }
          return next;
        });
      } catch {
        const error = "Network issue while loading payment proofs.";
        setPaymentFetchError(error);
        setPaymentTeams([]);

        if (showErrorToast) {
          toast({
            title: "Network Error",
            description: error,
            variant: "destructive",
          });
        }
      } finally {
        setIsPaymentLoading(false);
      }
    },
    [],
  );

  const refreshQueues = useCallback(
    async ({
      showErrorToast,
      statement,
    }: {
      showErrorToast?: boolean;
      statement: AdminReviewStatementFilter;
    }) => {
      setActiveStatement(statement);
      await Promise.all([
        fetchTeams({ showErrorToast, statement }),
        fetchPaymentTeams({ showErrorToast, statement }),
      ]);
    },
    [fetchPaymentTeams, fetchTeams],
  );

  useEffect(() => {
    refreshQueues({ statement: "all" }).catch(() => undefined);
  }, [refreshQueues]);

  const onStatementTabClick = (tabId: string) => {
    if (
      !isStatementFilter(tabId) ||
      tabId === activeStatement ||
      isLoading ||
      isPaymentLoading
    ) {
      return;
    }

    refreshQueues({ showErrorToast: true, statement: tabId }).catch(
      () => undefined,
    );
  };

  const updateDecision = async ({
    decision,
    teamId,
  }: {
    decision: "accepted" | "rejected";
    teamId: string;
  }) => {
    setPendingDecision({ decision, teamId });

    try {
      const response = await fetch(`/api/admin/review-submissions/${teamId}`, {
        body: JSON.stringify({ decision }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      const data = (await response.json().catch(() => null)) as
        | DecisionApiResponse
        | { error?: string }
        | null;

      if (
        !response.ok ||
        !data ||
        !("approvalStatus" in data) ||
        !("mail" in data)
      ) {
        const error =
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Could not update decision.";
        toast({
          title: "Decision Failed",
          description: error,
          variant: "destructive",
        });
        return;
      }

      setTeams((current) =>
        current.map((team) =>
          team.id === teamId
            ? {
                ...team,
                approvalStatus: data.approvalStatus,
              }
            : team,
        ),
      );

      if (!data.mail.sent) {
        toast({
          title: "Decision Saved, Mail Failed",
          description:
            data.mail.error ??
            `Decision was saved for this team, but mail could not be sent to ${
              data.mail.recipient ?? "the registered email"
            }.`,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: decision === "accepted" ? "Team Accepted" : "Team Rejected",
        description: data.mail.recipient
          ? `Decision saved and mail sent to ${data.mail.recipient}.`
          : "Decision saved and mail sent successfully.",
      });
    } catch {
      toast({
        title: "Network Error",
        description: "Could not reach admin review API.",
        variant: "destructive",
      });
    } finally {
      setPendingDecision(null);
    }
  };

  const updatePaymentDecision = async ({
    decision,
    teamId,
  }: {
    decision: "approved" | "rejected";
    teamId: string;
  }) => {
    const rejectionReason = paymentRejectionReasons[teamId]?.trim() ?? "";
    if (decision === "rejected" && !rejectionReason) {
      toast({
        title: "Rejection Reason Required",
        description: "Add a rejection reason before rejecting a payment proof.",
        variant: "destructive",
      });
      return;
    }

    setPendingPaymentDecision({ decision, teamId });

    try {
      const response = await fetch(`/api/admin/payment-proofs/${teamId}`, {
        body: JSON.stringify({
          decision,
          ...(decision === "rejected" ? { reason: rejectionReason } : {}),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "PATCH",
      });

      const data = (await response.json().catch(() => null)) as
        | PaymentDecisionApiResponse
        | { error?: string }
        | null;

      if (
        !response.ok ||
        !data ||
        !("paymentStatus" in data) ||
        !("paymentReviewedAt" in data)
      ) {
        const error =
          data && "error" in data && typeof data.error === "string"
            ? data.error
            : "Could not update payment status.";
        toast({
          title: "Payment Review Failed",
          description: error,
          variant: "destructive",
        });
        return;
      }

      setPaymentTeams((current) =>
        current.map((team) =>
          team.id === teamId
            ? {
                ...team,
                paymentRejectedReason: data.paymentRejectedReason,
                paymentReviewedAt: data.paymentReviewedAt,
                paymentStatus: data.paymentStatus,
              }
            : team,
        ),
      );

      setPaymentRejectionReasons((current) => ({
        ...current,
        [teamId]: data.paymentRejectedReason ?? "",
      }));

      toast({
        title:
          decision === "approved" ? "Payment Approved" : "Payment Rejected",
        description:
          decision === "approved"
            ? "Ticket access is now unlocked for this team."
            : "The team can re-upload a new payment proof now.",
      });
    } catch {
      toast({
        title: "Network Error",
        description: "Could not reach the payment review API.",
        variant: "destructive",
      });
    } finally {
      setPendingPaymentDecision(null);
    }
  };

  const activeTabCount = useMemo(() => {
    const matchedTab = tabs.find((tab) => tab.id === activeStatement);
    return matchedTab?.count ?? 0;
  }, [activeStatement, tabs]);

  const paymentStatusCounts = useMemo(
    () =>
      paymentTeams.reduce(
        (counts, team) => {
          counts[team.paymentStatus] += 1;
          return counts;
        },
        {
          approved: 0,
          not_submitted: 0,
          rejected: 0,
          submitted: 0,
        } satisfies Record<AdminPaymentProofStatus, number>,
      ),
    [paymentTeams],
  );

  const isRefreshing = isLoading || isPaymentLoading;

  const sectionNavItems = useMemo<AdminSectionNavItem[]>(
    () => [
      {
        count: teams.length,
        description: "PPT review",
        id: "review-queues",
        label: "Review Queues",
        tone: "blue",
      },
      {
        count: paymentTeams.length,
        description: "Payment review",
        id: "payment-review",
        label: "Payment Queue",
        tone: "green",
      },
      {
        count: initialTeamContacts.length,
        description: "Contacts",
        id: "contact-directory",
        label: "Contact Directory",
        tone: "orange",
      },
    ],
    [initialTeamContacts.length, paymentTeams.length, teams.length],
  );

  const scrollToSection = useCallback((sectionId: AdminSectionId) => {
    if (typeof document === "undefined") {
      return;
    }

    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const sectionIds: AdminSectionId[] = [
      "review-queues",
      "payment-review",
      "contact-directory",
    ];
    const sectionElements = sectionIds
      .map((sectionId) => document.getElementById(sectionId))
      .filter((element): element is HTMLElement => Boolean(element));

    if (sectionElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          );

        const topVisibleId = visibleEntries[0]?.target.id as
          | AdminSectionId
          | undefined;
        if (topVisibleId) {
          setActiveSection(topVisibleId);
        }
      },
      {
        rootMargin: "-18% 0px -55% 0px",
        threshold: [0.12, 0.35, 0.6],
      },
    );

    for (const element of sectionElements) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const downloadContactsCsv = () => {
    const rows = filteredAndSortedTeamContacts.map((team) => ({
      "Lead Phone Number": team.leadPhone ?? "",
      "Problem Statement": team.problemStatementTitle ?? "",
      "Problem Statement Number": team.problemStatementNumber ?? "",
      "Submission Status": toSubmissionStatusLabel(team.submissionStatus),
      "Team Member Phone Numbers":
        team.memberPhones.length > 0 ? team.memberPhones.join(", ") : "",
      "Team Name": team.teamName,
    }));
    const csv = toCsv({
      columns: CONTACT_EXPORT_COLUMNS,
      rows,
    });

    const blob = new Blob([csv], { type: "text/csv; charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${[
      "foundathon-team-contact-list",
      submissionFilter,
      new Date().toISOString().slice(0, 10),
    ].join("-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-gray-200 text-foreground">
      <div className="fncontainer relative space-y-8 py-10 md:py-14">
        <section className="sticky top-0 z-30 -mx-1 rounded-2xl border border-foreground/15 bg-background/88 p-3 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/78 md:top-2 md:p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-foreground/60">
                  Quick Navigation
                </p>
                <p className="mt-1 text-sm text-foreground/75">
                  Jump between the long admin sections without losing your
                  place.
                </p>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("review-queues")}
                className="rounded-full border border-foreground/15 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-foreground/70 transition hover:border-fnblue hover:text-fnblue"
              >
                Top
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {sectionNavItems.map((item) => {
                const isActive = activeSection === item.id;
                const toneClasses =
                  item.tone === "blue"
                    ? isActive
                      ? "border-fnblue bg-fnblue text-white shadow-md"
                      : "border-fnblue/25 bg-fnblue/8 text-fnblue hover:border-fnblue hover:bg-fnblue/12"
                    : item.tone === "green"
                      ? isActive
                        ? "border-fngreen bg-fngreen text-white shadow-md"
                        : "border-fngreen/25 bg-fngreen/8 text-fngreen hover:border-fngreen hover:bg-fngreen/12"
                      : isActive
                        ? "border-fnorange bg-fnorange text-white shadow-md"
                        : "border-fnorange/25 bg-fnorange/8 text-fnorange hover:border-fnorange hover:bg-fnorange/12";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${toneClasses}`}
                    aria-pressed={isActive}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em]">
                          {item.label}
                        </p>
                        <p
                          className={`mt-1 text-xs ${
                            isActive ? "text-white/85" : "text-foreground/70"
                          }`}
                        >
                          {item.description}
                        </p>
                      </div>
                      <span
                        className={`inline-flex min-w-10 items-center justify-center rounded-full px-2 py-1 text-xs font-black ${
                          isActive
                            ? "bg-white/18 text-white"
                            : "bg-white/75 text-foreground/80"
                        }`}
                      >
                        {item.count}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section
          id="review-queues"
          className="scroll-mt-28 rounded-2xl border border-b-4 border-fnblue bg-background/95 p-5 shadow-xl md:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full border border-fnblue bg-fnblue/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fnblue">
                Admin Review
              </p>
              <h1 className="mt-3 text-3xl font-black uppercase tracking-tight md:text-4xl">
                Review Queues
              </h1>
              <p className="mt-2 text-sm text-foreground/75">
                Signed in as <span className="font-semibold">{adminEmail}</span>
                . Manage PPT approvals and payment verification from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <FnButton
                type="button"
                tone="gray"
                size="sm"
                onClick={() =>
                  refreshQueues({
                    showErrorToast: true,
                    statement: activeStatement,
                  }).catch(() => undefined)
                }
                disabled={isRefreshing}
                loading={isRefreshing}
                loadingText="Refreshing..."
              >
                <RefreshCcw size={15} strokeWidth={2.6} />
                Refresh
              </FnButton>
              <FnButton asChild tone="gray" size="sm">
                <Link href="/admin/problem-statement-cap">Admin Controls</Link>
              </FnButton>
            </div>
          </div>

          <nav
            className="mt-6 flex flex-wrap gap-2"
            aria-label="Statement tabs"
          >
            {tabs.map((tab) => {
              const isActive = tab.id === activeStatement;
              return (
                <button
                  type="button"
                  key={tab.id}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition",
                    isActive
                      ? "border-fnblue bg-fnblue text-white"
                      : "border-foreground/20 bg-white text-foreground/75 hover:border-fnblue hover:text-fnblue",
                  ].join(" ")}
                  onClick={() => onStatementTabClick(tab.id)}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-fnblue/25 bg-fnblue/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-fnblue">
            Active Queue: {activeStatement.toUpperCase()} ({activeTabCount})
          </div>

          {fetchError ? (
            <div className="mt-4 rounded-xl border border-fnred/35 bg-fnred/10 p-4 text-sm text-fnred">
              {fetchError}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {!isLoading && teams.length === 0 ? (
              <div className="rounded-xl border border-foreground/15 bg-white p-6 text-center text-sm text-foreground/70">
                No PPT submitted teams found for this statement tab.
              </div>
            ) : null}

            {teams.map((team) => {
              const statusMeta = toStatusMeta(team.approvalStatus);
              const isPendingRow = pendingDecision?.teamId === team.id;

              return (
                <article
                  key={team.id}
                  className="rounded-xl border border-foreground/15 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black uppercase tracking-tight">
                        {team.teamName}
                      </h2>
                      <p className="mt-1 text-xs text-foreground/70">
                        Lead:{" "}
                        <span className="font-semibold text-foreground">
                          {team.leadName}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/70">
                        Team ID:{" "}
                        <span className="font-mono text-foreground">
                          {team.id}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/70">
                        Registration Email:{" "}
                        <span className="font-semibold text-foreground">
                          {team.registrationEmail || "N/A"}
                        </span>
                      </p>
                    </div>
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-foreground/75 md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-foreground">
                        Statement:
                      </span>{" "}
                      {team.problemStatementId
                        ? `${team.problemStatementId.toUpperCase()} • ${
                            team.problemStatementTitle ?? "Unknown"
                          }`
                        : "Unassigned"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        Uploaded:
                      </span>{" "}
                      {toDisplayDateTime(team.presentationUploadedAt)}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        File:
                      </span>{" "}
                      {team.presentationFileName}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        PPT URL:
                      </span>{" "}
                      <a
                        href={team.presentationPublicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-fnblue hover:underline"
                      >
                        Open File <ExternalLink className="inline" size={13} />
                      </a>
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <FnButton
                      type="button"
                      tone="blue"
                      size="sm"
                      onClick={() => setPreviewTeam(team)}
                      disabled={team.presentationPublicUrl.trim().length === 0}
                    >
                      View PPT
                    </FnButton>
                    <FnButton
                      type="button"
                      tone="green"
                      size="sm"
                      onClick={() =>
                        updateDecision({
                          decision: "accepted",
                          teamId: team.id,
                        })
                      }
                      disabled={
                        isPendingRow || team.approvalStatus === "accepted"
                      }
                      loading={
                        isPendingRow && pendingDecision?.decision === "accepted"
                      }
                      loadingText="Accepting..."
                    >
                      Accept
                    </FnButton>
                    <FnButton
                      type="button"
                      tone="red"
                      size="sm"
                      onClick={() =>
                        updateDecision({
                          decision: "rejected",
                          teamId: team.id,
                        })
                      }
                      disabled={
                        isPendingRow || team.approvalStatus === "rejected"
                      }
                      loading={
                        isPendingRow && pendingDecision?.decision === "rejected"
                      }
                      loadingText="Rejecting..."
                    >
                      Reject
                    </FnButton>
                  </div>
                </article>
              );
            })}

            {isLoading ? (
              <div className="rounded-xl border border-foreground/15 bg-white p-6 text-center text-sm text-foreground/70">
                Loading submitted teams...
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="payment-review"
          className="scroll-mt-28 rounded-2xl border border-b-4 border-fngreen bg-background/95 p-5 shadow-xl md:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full border border-fngreen bg-fngreen/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fngreen">
                Payment Verification
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight md:text-3xl">
                Accepted Team Payment Queue
              </h2>
              <p className="mt-2 text-sm text-foreground/75">
                Review Transaction IDs / UTRs and payment proofs before the team
                ticket unlocks.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-fngreen/25 bg-fngreen/5 p-3 text-xs font-semibold uppercase tracking-[0.12em] text-fngreen md:grid-cols-4">
            <p>Submitted: {paymentStatusCounts.submitted}</p>
            <p>Rejected: {paymentStatusCounts.rejected}</p>
            <p>Pending: {paymentStatusCounts.not_submitted}</p>
            <p>Approved: {paymentStatusCounts.approved}</p>
          </div>

          {paymentFetchError ? (
            <div className="mt-4 rounded-xl border border-fnred/35 bg-fnred/10 p-4 text-sm text-fnred">
              {paymentFetchError}
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {!isPaymentLoading && paymentTeams.length === 0 ? (
              <div className="rounded-xl border border-foreground/15 bg-white p-6 text-center text-sm text-foreground/70">
                No accepted teams found for this payment queue tab.
              </div>
            ) : null}

            {paymentTeams.map((team) => {
              const statusMeta = toPaymentStatusMeta(team.paymentStatus);
              const isPendingRow = pendingPaymentDecision?.teamId === team.id;
              const rejectionReasonInput =
                paymentRejectionReasons[team.id] ?? "";
              const canReviewTeam = team.paymentStatus === "submitted";

              return (
                <article
                  key={team.id}
                  className="rounded-xl border border-foreground/15 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black uppercase tracking-tight">
                        {team.teamName}
                      </h2>
                      <p className="mt-1 text-xs text-foreground/70">
                        Lead:{" "}
                        <span className="font-semibold text-foreground">
                          {team.leadName}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/70">
                        Team ID:{" "}
                        <span className="font-mono text-foreground">
                          {team.id}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/70">
                        Registration Email:{" "}
                        <span className="font-semibold text-foreground">
                          {team.registrationEmail || "N/A"}
                        </span>
                      </p>
                    </div>
                    <div
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${statusMeta.badgeClass}`}
                    >
                      {statusMeta.label}
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-foreground/75 md:grid-cols-2">
                    <p>
                      <span className="font-semibold text-foreground">
                        Statement:
                      </span>{" "}
                      {team.problemStatementId
                        ? `${team.problemStatementId.toUpperCase()} • ${
                            team.problemStatementTitle ?? "Unknown"
                          }`
                        : "Unassigned"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        Transaction ID / UTR:
                      </span>{" "}
                      {team.paymentUtr || "Not submitted"}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        Submitted:
                      </span>{" "}
                      {toDisplayDateTime(team.paymentSubmittedAt ?? "")}
                    </p>
                    <p>
                      <span className="font-semibold text-foreground">
                        Reviewed:
                      </span>{" "}
                      {toDisplayDateTime(team.paymentReviewedAt ?? "")}
                    </p>
                  </div>

                  {team.paymentRejectedReason ? (
                    <div className="mt-3 rounded-xl border border-fnred/25 bg-fnred/8 p-3 text-sm text-fnred">
                      <span className="font-semibold uppercase tracking-[0.1em]">
                        Last Rejection Reason:
                      </span>{" "}
                      {team.paymentRejectedReason}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {team.paymentStatus !== "not_submitted" ? (
                      <FnButton asChild tone="gray" size="sm">
                        <a
                          href={`/api/admin/payment-proofs/${team.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={16} strokeWidth={3} />
                          Preview Proof
                        </a>
                      </FnButton>
                    ) : null}
                    <FnButton
                      type="button"
                      tone="green"
                      size="sm"
                      onClick={() =>
                        updatePaymentDecision({
                          decision: "approved",
                          teamId: team.id,
                        })
                      }
                      disabled={!canReviewTeam || isPendingRow}
                      loading={
                        isPendingRow &&
                        pendingPaymentDecision?.decision === "approved"
                      }
                      loadingText="Approving..."
                    >
                      Approve
                    </FnButton>
                    <FnButton
                      type="button"
                      tone="red"
                      size="sm"
                      onClick={() =>
                        updatePaymentDecision({
                          decision: "rejected",
                          teamId: team.id,
                        })
                      }
                      disabled={!canReviewTeam || isPendingRow}
                      loading={
                        isPendingRow &&
                        pendingPaymentDecision?.decision === "rejected"
                      }
                      loadingText="Rejecting..."
                    >
                      Reject
                    </FnButton>
                  </div>

                  <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-3">
                    <label
                      htmlFor={`payment-reason-${team.id}`}
                      className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/60"
                    >
                      Rejection Reason
                    </label>
                    <textarea
                      id={`payment-reason-${team.id}`}
                      value={rejectionReasonInput}
                      onChange={(event) =>
                        setPaymentRejectionReasons((current) => ({
                          ...current,
                          [team.id]: event.target.value,
                        }))
                      }
                      placeholder="Required only when rejecting a submitted payment proof"
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-fnblue"
                    />
                  </div>
                </article>
              );
            })}

            {isPaymentLoading ? (
              <div className="rounded-xl border border-foreground/15 bg-white p-6 text-center text-sm text-foreground/70">
                Loading payment review queue...
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="contact-directory"
          className="scroll-mt-28 rounded-2xl border border-b-4 border-fnblue bg-background/95 p-5 shadow-xl md:p-8"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex rounded-full border border-fnblue bg-fnblue/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-fnblue">
                PR Calling Sheet
              </p>
              <h2 className="mt-3 text-2xl font-black uppercase tracking-tight md:text-3xl">
                Team Contact Directory
              </h2>
              <p className="mt-2 text-sm text-foreground/75">
                Export filtered rows and call teams individually.
              </p>
            </div>
            <FnButton
              type="button"
              tone="blue"
              onClick={downloadContactsCsv}
              disabled={filteredAndSortedTeamContacts.length === 0}
            >
              Download CSV
            </FnButton>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl border border-fnblue/25 bg-fnblue/5 p-3 text-xs font-semibold uppercase tracking-[0.12em] text-fnblue md:grid-cols-3">
            <p>Total Teams: {initialTeamContacts.length}</p>
            <p>Submitted: {submittedCount}</p>
            <p>Non-submitted: {nonSubmittedCount}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSubmissionFilter("all")}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                submissionFilter === "all"
                  ? "border-fnblue bg-fnblue text-white"
                  : "border-foreground/20 bg-white text-foreground/75 hover:border-fnblue hover:text-fnblue"
              }`}
            >
              All Teams ({initialTeamContacts.length})
            </button>
            <button
              type="button"
              onClick={() => setSubmissionFilter("submitted")}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                submissionFilter === "submitted"
                  ? "border-fngreen bg-fngreen text-white"
                  : "border-foreground/20 bg-white text-foreground/75 hover:border-fngreen hover:text-fngreen"
              }`}
            >
              Submitted ({submittedCount})
            </button>
            <button
              type="button"
              onClick={() => setSubmissionFilter("non_submitted")}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                submissionFilter === "non_submitted"
                  ? "border-fnred bg-fnred text-white"
                  : "border-foreground/20 bg-white text-foreground/75 hover:border-fnred hover:text-fnred"
              }`}
            >
              Non-submitted ({nonSubmittedCount})
            </button>

            <label className="ml-auto flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-foreground/75">
              Sort Status
              <select
                className="rounded-lg border border-foreground/20 bg-background px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-foreground outline-none focus:border-fnblue"
                value={submissionSortOrder}
                onChange={(event) =>
                  setSubmissionSortOrder(
                    event.target.value as SubmissionSortOrder,
                  )
                }
              >
                <option value="non_submitted_first">Non-submitted first</option>
                <option value="submitted_first">Submitted first</option>
              </select>
            </label>
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-foreground/15 bg-white">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase tracking-[0.12em] text-foreground/70">
                  {CONTACT_EXPORT_COLUMNS.map((column) => (
                    <th key={column} className="px-3 py-2 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedTeamContacts.map((team) => (
                  <tr
                    key={team.id}
                    className="border-b border-foreground/10 align-top last:border-b-0"
                  >
                    <td className="px-3 py-3 font-semibold text-foreground">
                      {team.teamName}
                    </td>
                    <td className="px-3 py-3 text-foreground/90">
                      {team.problemStatementNumber ?? "N/A"}
                    </td>
                    <td className="px-3 py-3 text-foreground/90">
                      {team.problemStatementTitle ?? "Not locked"}
                    </td>
                    <td className="px-3 py-3 text-foreground/90">
                      {team.leadPhone ?? "N/A"}
                    </td>
                    <td className="px-3 py-3 text-foreground/90">
                      {team.memberPhones.length > 0
                        ? team.memberPhones.join(", ")
                        : "N/A"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${
                          team.submissionStatus === "submitted"
                            ? "border-fngreen/40 bg-fngreen/10 text-fngreen"
                            : "border-fnred/40 bg-fnred/10 text-fnred"
                        }`}
                      >
                        {toSubmissionStatusLabel(team.submissionStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAndSortedTeamContacts.length === 0 ? (
            <p className="mt-4 rounded-xl border border-foreground/15 bg-foreground/[0.03] p-4 text-center text-sm text-foreground/70">
              No teams match this submission filter yet.
            </p>
          ) : null}
        </section>
      </div>

      <PresentationPreviewModal
        fileName={previewTeam?.presentationFileName ?? ""}
        isOpen={Boolean(previewTeam)}
        onClose={() => setPreviewTeam(null)}
        publicUrl={previewTeam?.presentationPublicUrl ?? ""}
      />
    </main>
  );
}
