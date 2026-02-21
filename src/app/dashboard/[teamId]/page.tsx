"use client";

import { PlusIcon, Trash2, UserRoundPen } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { useRouteProgress } from "@/components/ui/route-progress";
import { toast } from "@/hooks/use-toast";
import {
  findProblemStatementSummary,
  isValidEmailAddress,
  type ProblemLockEmailPayload,
  type ProblemLockEmailResponse,
  toSrmLeadEmail,
} from "@/lib/problem-lock-email";
import {
  type NonSrmMember,
  nonSrmMemberSchema,
  type SrmMember,
  srmMemberSchema,
  type TeamRecord,
  teamSubmissionSchema,
} from "@/lib/register-schema";

type TeamType = "srm" | "non_srm";

type NonSrmMeta = {
  collegeName: string;
  isClub: boolean;
  clubName: string;
};

type ProblemStatementInfo = {
  cap: number | null;
  id: string;
  lockedAt: string;
  title: string;
};

type ProblemStatementAvailability = {
  id: string;
  isFull: boolean;
  summary: string;
  title: string;
};

const MAX_MEMBERS = 5;

const emptySrmMember = (): SrmMember => ({
  name: "",
  raNumber: "",
  netId: "",
  dept: "",
  contact: 0,
});

const emptyNonSrmMember = (): NonSrmMember => ({
  name: "",
  collegeId: "",
  collegeEmail: "",
  contact: 0,
});

const emptyProblemStatement = (): ProblemStatementInfo => ({
  cap: null,
  id: "",
  lockedAt: "",
  title: "",
});

const formatDateTime = (value: string) => {
  if (!value) return "N/A";
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? value
    : parsedDate.toLocaleString();
};

export default function TeamDashboardPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const { start: startRouteProgress } = useRouteProgress();
  const teamId = params.teamId;

  const [teamType, setTeamType] = useState<TeamType>("srm");
  const [teamName, setTeamName] = useState("");
  const [leadSrm, setLeadSrm] = useState<SrmMember>(emptySrmMember);
  const [membersSrm, setMembersSrm] = useState<SrmMember[]>([]);
  const [draftSrm, setDraftSrm] = useState<SrmMember>(emptySrmMember);

  const [leadNonSrm, setLeadNonSrm] = useState<NonSrmMember>(emptyNonSrmMember);
  const [membersNonSrm, setMembersNonSrm] = useState<NonSrmMember[]>([]);
  const [draftNonSrm, setDraftNonSrm] =
    useState<NonSrmMember>(emptyNonSrmMember);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSrm, setEditingSrm] = useState<SrmMember>(emptySrmMember);
  const [editingNonSrm, setEditingNonSrm] =
    useState<NonSrmMember>(emptyNonSrmMember);
  const [metaNonSrm, setMetaNonSrm] = useState<NonSrmMeta>({
    collegeName: "",
    isClub: false,
    clubName: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAssigningStatement, setIsAssigningStatement] = useState(false);
  const [isLoadingStatements, setIsLoadingStatements] = useState(false);
  const [isLockingProblemStatementId, setIsLockingProblemStatementId] =
    useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorIsAuth, setLoadErrorIsAuth] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState("");
  const [problemStatement, setProblemStatement] =
    useState<ProblemStatementInfo>(emptyProblemStatement());
  const [problemStatements, setProblemStatements] = useState<
    ProblemStatementAvailability[]
  >([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const currentMembers = teamType === "srm" ? membersSrm : membersNonSrm;
  const currentLeadId =
    teamType === "srm" ? leadSrm.netId : leadNonSrm.collegeId;
  const memberCount = 1 + currentMembers.length;
  const canAddMember = memberCount < MAX_MEMBERS;
  const getCurrentMemberId = (member: SrmMember | NonSrmMember) =>
    teamType === "srm"
      ? (member as SrmMember).netId
      : (member as NonSrmMember).collegeId;

  const completedProfiles = useMemo(() => {
    if (teamType === "srm") {
      const leadOk = srmMemberSchema.safeParse(leadSrm).success ? 1 : 0;
      return (
        leadOk +
        membersSrm.filter((item) => srmMemberSchema.safeParse(item).success)
          .length
      );
    }
    const leadOk = nonSrmMemberSchema.safeParse(leadNonSrm).success ? 1 : 0;
    return (
      leadOk +
      membersNonSrm.filter((item) => nonSrmMemberSchema.safeParse(item).success)
        .length
    );
  }, [leadNonSrm, leadSrm, membersNonSrm, membersSrm, teamType]);

  const teamPayload = useMemo(
    () =>
      teamType === "srm"
        ? {
            teamType: "srm" as const,
            teamName,
            lead: leadSrm,
            members: membersSrm,
          }
        : {
            teamType: "non_srm" as const,
            teamName,
            collegeName: metaNonSrm.collegeName,
            isClub: metaNonSrm.isClub,
            clubName: metaNonSrm.isClub ? metaNonSrm.clubName : "",
            lead: leadNonSrm,
            members: membersNonSrm,
          },
    [
      leadNonSrm,
      leadSrm,
      membersNonSrm,
      membersSrm,
      metaNonSrm.clubName,
      metaNonSrm.collegeName,
      metaNonSrm.isClub,
      teamName,
      teamType,
    ],
  );

  const loadProblemStatements = useCallback(async () => {
    setIsLoadingStatements(true);
    try {
      const response = await fetch("/api/problem-statements", {
        method: "GET",
      });
      const data = (await response.json()) as {
        error?: string;
        statements?: ProblemStatementAvailability[];
      };

      if (!response.ok || !data.statements) {
        toast({
          title: "Unable to Load Problem Statements",
          description:
            data.error ??
            "We couldn't fetch problem statement availability right now.",
          variant: "destructive",
        });
        return;
      }

      setProblemStatements(data.statements);
    } catch {
      toast({
        title: "Problem Statement Request Failed",
        description:
          "Network issue while loading problem statements. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingStatements(false);
    }
  }, []);

  useEffect(() => {
    const recoverWithLatestTeam = async () => {
      try {
        const listResponse = await fetch("/api/register", { method: "GET" });
        const listData = (await listResponse.json()) as {
          teams?: Array<{ id?: string }>;
        };

        if (!listResponse.ok) {
          return false;
        }

        const latestTeamId = listData.teams?.[0]?.id;
        if (!latestTeamId || latestTeamId === teamId) {
          return false;
        }

        toast({
          title: "Redirecting to Latest Team",
          description:
            "The requested dashboard was not available. Opening your latest registered team.",
          variant: "success",
        });
        startRouteProgress();
        router.replace(`/dashboard/${latestTeamId}`);
        return true;
      } catch {
        return false;
      }
    };

    const loadTeam = async () => {
      setIsLoading(true);
      setLoadError(null);
      setLoadErrorIsAuth(false);
      try {
        const res = await fetch(`/api/register/${teamId}`, { method: "GET" });
        const data = (await res.json()) as {
          team?: TeamRecord;
          error?: string;
        };

        if (!res.ok || !data.team) {
          const message =
            data.error ??
            "We couldn't load this team. It may have been deleted or you may not have access.";

          if (res.status === 404 || res.status === 422) {
            const recovered = await recoverWithLatestTeam();
            if (recovered) {
              return;
            }
          }

          setLoadError(message);
          setLoadErrorIsAuth(res.status === 401);
          toast({
            title: "Team Not Available",
            description: message,
            variant: "destructive",
          });
          return;
        }

        setLoadError(null);
        setLoadErrorIsAuth(false);
        const team = data.team;
        setTeamType(team.teamType);
        setTeamName(team.teamName);
        setCreatedAt(team.createdAt);
        setUpdatedAt(team.updatedAt);
        setProblemStatement({
          cap: team.problemStatementCap ?? null,
          id: team.problemStatementId ?? "",
          lockedAt: team.problemStatementLockedAt ?? "",
          title: team.problemStatementTitle ?? "",
        });

        if (team.teamType === "srm") {
          setLeadSrm(team.lead);
          setMembersSrm(team.members);
          setDraftSrm(emptySrmMember());
        } else {
          setLeadNonSrm(team.lead);
          setMembersNonSrm(team.members);
          setDraftNonSrm(emptyNonSrmMember());
          setMetaNonSrm({
            collegeName: team.collegeName,
            isClub: team.isClub,
            clubName: team.clubName,
          });
        }
      } catch {
        setLoadError("We couldn't fetch your team details right now.");
        setLoadErrorIsAuth(false);
        toast({
          title: "Unable to Load Dashboard",
          description:
            "We couldn't fetch your team details. Please refresh and try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    void loadTeam();
  }, [router, startRouteProgress, teamId]);

  useEffect(() => {
    if (isLoading || problemStatement.id) {
      return;
    }

    void loadProblemStatements();
  }, [isLoading, loadProblemStatements, problemStatement.id]);

  if (loadError) {
    return (
      <main className="min-h-screen bg-slate-100 text-foreground">
        <div className="fncontainer py-12 md:py-16">
          <div className="mx-auto max-w-2xl rounded-2xl border border-foreground/15 bg-background p-8 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnred">
              Dashboard Unavailable
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              We couldn't open this team dashboard
            </h1>
            <p className="mt-3 text-sm text-foreground/75 md:text-base">
              {loadError}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {loadErrorIsAuth ? (
                <FnButton asChild>
                  <Link
                    href={`/api/auth/login?next=${encodeURIComponent(
                      `/dashboard/${teamId}`,
                    )}`}
                  >
                    Sign In
                  </Link>
                </FnButton>
              ) : (
                <FnButton
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </FnButton>
              )}
              <FnButton asChild tone="gray">
                <Link href="/register">Go to Registration</Link>
              </FnButton>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const addMember = () => {
    if (!canAddMember) return;
    if (teamType === "srm") {
      const parsed = srmMemberSchema.safeParse(draftSrm);
      if (!parsed.success) {
        toast({
          title: "Member Details Invalid",
          description:
            parsed.error.issues[0]?.message ??
            "Please correct member details before adding.",
          variant: "destructive",
        });
        return;
      }
      setMembersSrm((prev) => [...prev, parsed.data]);
      setDraftSrm(emptySrmMember());
      toast({
        title: "Member Added to Draft",
        description: "The member has been added. Remember to save changes!",
        variant: "success",
      });
      return;
    }

    const parsed = nonSrmMemberSchema.safeParse(draftNonSrm);
    if (!parsed.success) {
      toast({
        title: "Member Details Invalid",
        description:
          parsed.error.issues[0]?.message ??
          "Please correct member details before adding.",
        variant: "destructive",
      });
      return;
    }
    setMembersNonSrm((prev) => [...prev, parsed.data]);
    setDraftNonSrm(emptyNonSrmMember());
    toast({
      title: "Member Added to Draft",
      description: "The member has been added. Remember to save changes!",
      variant: "success",
    });
  };

  const removeMember = (index: number) => {
    if (teamType === "srm") {
      setMembersSrm((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setMembersNonSrm((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const beginEditMember = (index: number) => {
    setEditingIndex(index);
    if (teamType === "srm") {
      setEditingSrm(membersSrm[index]);
    } else {
      setEditingNonSrm(membersNonSrm[index]);
    }
  };

  const cancelEditMember = () => {
    setEditingIndex(null);
    setEditingSrm(emptySrmMember());
    setEditingNonSrm(emptyNonSrmMember());
  };

  const saveEditMember = () => {
    if (editingIndex === null) return;

    if (teamType === "srm") {
      const parsed = srmMemberSchema.safeParse(editingSrm);
      if (!parsed.success) {
        toast({
          title: "Member Update Invalid",
          description:
            parsed.error.issues[0]?.message ??
            "Please correct member details before saving this update.",
          variant: "destructive",
        });
        return;
      }
      setMembersSrm((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? parsed.data : item)),
      );
    } else {
      const parsed = nonSrmMemberSchema.safeParse(editingNonSrm);
      if (!parsed.success) {
        toast({
          title: "Member Update Invalid",
          description:
            parsed.error.issues[0]?.message ??
            "Please correct member details before saving this update.",
          variant: "destructive",
        });
        return;
      }
      setMembersNonSrm((prev) =>
        prev.map((item, idx) => (idx === editingIndex ? parsed.data : item)),
      );
    }

    toast({
      title: "Member Draft Updated",
      description: "Member changes are valid. Remember to save changes!",
      variant: "success",
    });
    cancelEditMember();
  };

  const saveChanges = async () => {
    const parsed = teamSubmissionSchema.safeParse(teamPayload);
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ??
        "Please fix the team details and try again.";
      setFormError(message);
      toast({
        title: "Team Details Invalid",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setFormError(null);
    setIsSaving(true);
    try {
      const res = await fetch(`/api/register/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { team?: TeamRecord; error?: string };

      if (!res.ok || !data.team) {
        const message =
          data.error ?? "We couldn't save your team changes. Please try again.";
        setFormError(message);
        toast({
          title: "Could Not Save Team",
          description: message,
          variant: "destructive",
        });
        return;
      }

      setUpdatedAt(data.team.updatedAt);
      setFormError(null);
      toast({
        title: "Team Changes Saved",
        description: "Your latest team details have been saved successfully.",
        variant: "success",
      });
    } catch {
      setFormError(
        "Network issue while saving team changes. Please check connection and retry.",
      );
      toast({
        title: "Save Request Failed",
        description:
          "Network issue while saving team changes. Please check connection and retry.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const notifyProblemStatementLockByEmail = async (input: {
    lockExpiresAtIso: string;
    lockedAtIso: string;
    problemStatementId: string;
    problemStatementTitle: string;
  }) => {
    const leadName =
      teamType === "srm" ? leadSrm.name.trim() : leadNonSrm.name.trim();
    const leadEmail =
      teamType === "srm"
        ? toSrmLeadEmail(leadSrm.netId)
        : leadNonSrm.collegeEmail.trim().toLowerCase();

    if (!leadName || !isValidEmailAddress(leadEmail)) {
      return {
        reason: "invalid_lead_email" as const,
        sent: false,
      };
    }

    const payload: ProblemLockEmailPayload = {
      notificationType: "lock_confirmed",
      leadEmail,
      leadName,
      lockExpiresAtIso: input.lockExpiresAtIso,
      lockedAtIso: input.lockedAtIso,
      problemStatementId: input.problemStatementId,
      problemStatementSummary: findProblemStatementSummary(
        problemStatements,
        input.problemStatementId,
      ),
      problemStatementTitle: input.problemStatementTitle,
      teamName: teamName.trim() || "Unnamed Team",
    };

    try {
      const response = await fetch("/api/send", {
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = (await response.json()) as Partial<ProblemLockEmailResponse>;
      if (response.ok && data.sent === true) {
        return { sent: true as const };
      }

      return {
        error: typeof data.error === "string" ? data.error : undefined,
        reason:
          typeof data.reason === "string" ? data.reason : "provider_error",
        sent: false as const,
      };
    } catch {
      return {
        reason: "request_failed" as const,
        sent: false,
      };
    }
  };

  const lockLegacyProblemStatement = async (problemStatementId: string) => {
    if (problemStatement.id) {
      return;
    }

    const parsedTeam = teamSubmissionSchema.safeParse(teamPayload);
    if (!parsedTeam.success) {
      const message =
        parsedTeam.error.issues[0]?.message ??
        "Please fix team details before locking a problem statement.";
      setFormError(message);
      toast({
        title: "Team Details Invalid",
        description: message,
        variant: "destructive",
      });
      return;
    }

    setFormError(null);
    setIsLockingProblemStatementId(problemStatementId);
    setIsAssigningStatement(true);

    try {
      const lockResponse = await fetch("/api/problem-statements/lock", {
        body: JSON.stringify({ problemStatementId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const lockData = (await lockResponse.json()) as {
        error?: string;
        lockExpiresAt?: string;
        lockToken?: string;
        locked?: boolean;
        problemStatement?: { id: string; title: string };
      };

      if (
        !lockResponse.ok ||
        !lockData.locked ||
        !lockData.lockExpiresAt ||
        !lockData.lockToken ||
        !lockData.problemStatement
      ) {
        toast({
          title: "Could Not Lock Problem Statement",
          description:
            lockData.error ??
            "We couldn't lock this statement. Please try another one.",
          variant: "destructive",
        });
        return;
      }

      const patchResponse = await fetch(`/api/register/${teamId}`, {
        body: JSON.stringify({
          ...parsedTeam.data,
          lockToken: lockData.lockToken,
          problemStatementId: lockData.problemStatement.id,
        }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });

      const patchData = (await patchResponse.json()) as {
        error?: string;
        team?: TeamRecord;
      };

      if (!patchResponse.ok || !patchData.team) {
        toast({
          title: "Could Not Assign Problem Statement",
          description:
            patchData.error ??
            "Lock succeeded but statement assignment failed. Please retry.",
          variant: "destructive",
        });
        return;
      }

      setUpdatedAt(patchData.team.updatedAt);
      setProblemStatement({
        cap: patchData.team.problemStatementCap ?? null,
        id: patchData.team.problemStatementId ?? "",
        lockedAt: patchData.team.problemStatementLockedAt ?? "",
        title: patchData.team.problemStatementTitle ?? "",
      });

      const lockedAtIso =
        patchData.team.problemStatementLockedAt ?? new Date().toISOString();
      const emailResult = await notifyProblemStatementLockByEmail({
        lockExpiresAtIso: lockData.lockExpiresAt,
        lockedAtIso,
        problemStatementId: lockData.problemStatement.id,
        problemStatementTitle: lockData.problemStatement.title,
      });

      if (emailResult.sent) {
        toast({
          title: "Problem Statement Locked",
          description:
            "Problem statement locked and confirmation email sent to the lead's mail.",
          variant: "success",
        });
      } else if (emailResult.reason === "invalid_lead_email") {
        toast({
          title: "Problem Statement Locked",
          description:
            "Problem statement locked, but lead email is missing or invalid. Confirmation email was not sent.",
        });
      } else {
        toast({
          title: "Problem Statement Locked",
          description:
            "Problem statement locked, but we could not send the confirmation email right now.",
        });
      }
      await loadProblemStatements();
    } catch {
      toast({
        title: "Problem Statement Assignment Failed",
        description:
          "Network issue while assigning statement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAssigningStatement(false);
      setIsLockingProblemStatementId(null);
    }
  };

  const deleteTeam = async () => {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);
    let isNavigating = false;
    try {
      const res = await fetch(`/api/register/${teamId}`, { method: "DELETE" });
      if (res.ok) {
        toast({
          title: "Team Deleted",
          description:
            "The team was removed successfully. Redirecting to registration page.",
          variant: "success",
        });
        setShowDeleteConfirm(false);
        isNavigating = true;
        startRouteProgress();
        router.push("/register");
        return;
      }
      toast({
        title: "Team Deletion Failed",
        description:
          "We couldn't delete this team right now. Please try again later.",
        variant: "destructive",
      });
    } catch {
      toast({
        title: "Delete Request Failed",
        description:
          "Network issue while deleting the team. Please check connection and retry.",
        variant: "destructive",
      });
    } finally {
      if (!isNavigating) {
        setIsDeleting(false);
      }
    }
  };

  const teamTypeLabel = teamType === "srm" ? "SRM Team" : "Non-SRM Team";
  const problemStatementTitle =
    problemStatement.title || "No problem statement selected";
  const hasLockedProblemStatement = Boolean(
    problemStatement.id || problemStatement.title,
  );
  const problemStatementStatusLabel = hasLockedProblemStatement
    ? "Locked"
    : "Pending";
  const problemStatementStatusTone = hasLockedProblemStatement
    ? "green"
    : "red";

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-40 pointer-events-none"
          style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
        />
        <div className="absolute -top-24 right-0 size-80 rounded-full bg-fnblue/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-12 size-80 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none" />

        <div className="fncontainer relative py-10 md:py-14">
          <div className="h-8 w-56 animate-pulse rounded-md bg-foreground/10" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded-md bg-foreground/10" />

          <section className="mt-6 rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-lg">
            <div className="h-4 w-44 animate-pulse rounded-md bg-foreground/10" />
            <div className="mt-3 h-9 w-3/4 animate-pulse rounded-md bg-foreground/10" />
            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
              <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
              <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
              <div className="h-14 animate-pulse rounded-lg bg-foreground/10" />
            </div>
          </section>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fnblue bg-background/90" />
            <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fngreen bg-background/90" />
            <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fnorange bg-background/90" />
            <div className="h-24 animate-pulse rounded-xl border border-b-4 border-fnyellow bg-background/90" />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg">
              <div className="h-6 w-40 animate-pulse rounded-md bg-foreground/10" />
              <div className="mt-3 h-4 w-72 animate-pulse rounded-md bg-foreground/10" />
              <div className="mt-6 h-16 animate-pulse rounded-xl bg-foreground/10" />
              <div className="mt-4 h-20 animate-pulse rounded-xl bg-foreground/10" />
              <div className="mt-4 h-20 animate-pulse rounded-xl bg-foreground/10" />
            </section>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-6 shadow-lg">
                <div className="h-5 w-44 animate-pulse rounded-md bg-foreground/10" />
                <div className="mt-4 space-y-3">
                  <div className="h-10 animate-pulse rounded-md bg-foreground/10" />
                  <div className="h-10 animate-pulse rounded-md bg-foreground/10" />
                  <div className="h-10 animate-pulse rounded-md bg-foreground/10" />
                </div>
              </div>

              <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-lg">
                <div className="h-5 w-32 animate-pulse rounded-md bg-foreground/10" />
                <div className="mt-4 space-y-2">
                  <div className="h-9 animate-pulse rounded-md bg-foreground/10" />
                  <div className="h-9 animate-pulse rounded-md bg-foreground/10" />
                  <div className="h-9 animate-pulse rounded-md bg-foreground/10" />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="absolute -top-24 right-0 size-96 rounded-full bg-fnblue/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-28 -left-16 size-96 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none" />

      <div className="fncontainer relative py-10 md:py-14">
        <header className="mb-6 rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg">
          <p className="inline-flex rounded-full border border-fnblue/35 bg-fnblue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-fnblue">
            Dashboard
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight md:text-4xl uppercase">
            Team Management Board
          </h1>
          <p className="mt-2 text-sm text-foreground/70 md:text-base">
            Update your roster, keep profiles complete, and ship toward the
            final pitch.
          </p>
        </header>

        <section
          className={`mb-6 relative overflow-hidden rounded-2xl border border-b-4 p-6 md:p-8 shadow-xl ${
            hasLockedProblemStatement
              ? "border-fnyellow bg-linear-to-br from-fnyellow/30 via-background to-fnblue/10"
              : "border-fnred bg-linear-to-br from-fnred/20 via-background to-fnorange/10"
          }`}
        >
          <div className="absolute -top-10 -right-10 size-36 rounded-full bg-fnblue/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 size-32 rounded-full bg-fnyellow/25 blur-2xl pointer-events-none" />

          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/75">
                Locked Problem Statement
              </p>
              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                  problemStatementStatusTone === "green"
                    ? "border-fngreen/35 bg-fngreen/10 text-fngreen"
                    : "border-fnred/35 bg-fnred/10 text-fnred"
                }`}
              >
                {problemStatementStatusLabel}
              </span>
            </div>

            <h2 className="mt-3 text-2xl font-black uppercase tracking-tight md:text-3xl">
              {problemStatementTitle}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-foreground/75 md:text-base">
              {hasLockedProblemStatement
                ? "This is your official track for Foundathon 3.0. Keep your build and pitch aligned to this statement."
                : "No statement lock is attached to this team record yet. Contact the organizing team if this is unexpected."}
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <HighlightTile
                label="Statement ID"
                value={problemStatement.id || "N/A"}
                tone="blue"
              />
              <HighlightTile
                label="Locked At"
                value={formatDateTime(problemStatement.lockedAt)}
                tone="green"
              />
              <HighlightTile
                label="Created On"
                value={formatDateTime(createdAt)}
                tone="orange"
              />
            </div>
          </div>
        </section>

        {!hasLockedProblemStatement ? (
          <section className="mb-6 rounded-2xl border border-b-4 border-fnred bg-background/95 p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fnred">
              Legacy Team Action Required
            </p>
            <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
              lock a problem statement now
            </h3>
            <p className="mt-2 text-sm text-foreground/75 md:text-base">
              This team was registered before statement locking was introduced.
              Choose one statement below to complete your team profile.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {isLoadingStatements
                ? ["one", "two", "three", "four"].map((item) => (
                    <div
                      key={`legacy-statement-skeleton-${item}`}
                      className="h-40 animate-pulse rounded-xl border border-b-4 border-fnblue/40 bg-foreground/5"
                    />
                  ))
                : problemStatements.map((statement) => (
                    <div
                      key={statement.id}
                      className="rounded-xl border border-b-4 border-fnblue/45 bg-white p-4 shadow-sm"
                    >
                      <p className="text-[10px] uppercase tracking-[0.16em] text-fnblue font-semibold">
                        {statement.id}
                      </p>
                      <h4 className="mt-2 text-sm font-black uppercase tracking-[0.06em]">
                        {statement.title}
                      </h4>
                      <p className="mt-2 text-xs text-foreground/75 leading-relaxed">
                        {statement.summary}
                      </p>
                      <div className="mt-4">
                        {statement.isFull ? (
                          <FnButton type="button" tone="gray" disabled>
                            Full
                          </FnButton>
                        ) : (
                          <FnButton
                            type="button"
                            onClick={() =>
                              lockLegacyProblemStatement(statement.id)
                            }
                            disabled={
                              isAssigningStatement ||
                              isSaving ||
                              isDeleting ||
                              isLoading
                            }
                            loading={
                              isLockingProblemStatementId === statement.id
                            }
                            loadingText="Locking..."
                          >
                            Lock and Assign
                          </FnButton>
                        )}
                      </div>
                    </div>
                  ))}
            </div>
          </section>
        ) : null}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Team Type" value={teamTypeLabel} tone="blue" />
          <StatCard
            label="Team Members"
            value={`${memberCount}/5`}
            tone="green"
          />
          <StatCard
            label="Completed Profiles"
            value={`${completedProfiles}/${memberCount}`}
            tone="orange"
          />
          <StatCard
            label="Last Updated"
            value={formatDateTime(updatedAt)}
            tone="yellow"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg md:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnblue">
              Team Details
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight uppercase">
              Edit Team Information
            </h2>

            <div className="mt-6 rounded-xl border border-b-4 border-fnblue/40 bg-white p-4">
              <Input
                label="Team Name"
                value={teamName}
                onChange={setTeamName}
              />
            </div>

            {teamType === "non_srm" && (
              <div className="mt-6 rounded-xl border border-b-4 border-fngreen/45 bg-white p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="College Name"
                    value={metaNonSrm.collegeName}
                    onChange={(v) =>
                      setMetaNonSrm((prev) => ({ ...prev, collegeName: v }))
                    }
                  />
                </div>
                <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={metaNonSrm.isClub}
                    onChange={(event) =>
                      setMetaNonSrm((prev) => ({
                        ...prev,
                        isClub: event.target.checked,
                        clubName: event.target.checked ? prev.clubName : "",
                      }))
                    }
                  />
                  Team represents a club
                </label>
                <div className="mt-3">
                  <Input
                    label="Club Name"
                    value={metaNonSrm.clubName}
                    onChange={(v) =>
                      setMetaNonSrm((prev) => ({ ...prev, clubName: v }))
                    }
                  />
                </div>
              </div>
            )}

            {teamType === "srm" ? (
              <>
                <SrmEditor
                  title="Team Lead"
                  member={leadSrm}
                  onChange={(field, value) =>
                    setLeadSrm(
                      (prev) => ({ ...prev, [field]: value }) as SrmMember,
                    )
                  }
                  className="mt-6 border-b-4 border-fnblue/45"
                />
                <SrmEditor
                  title="Member Draft"
                  member={draftSrm}
                  onChange={(field, value) =>
                    setDraftSrm(
                      (prev) => ({ ...prev, [field]: value }) as SrmMember,
                    )
                  }
                  className="mt-4 border-b-4 border-fngreen/45"
                />
              </>
            ) : (
              <>
                <NonSrmEditor
                  title="Team Lead"
                  member={leadNonSrm}
                  onChange={(field, value) =>
                    setLeadNonSrm(
                      (prev) => ({ ...prev, [field]: value }) as NonSrmMember,
                    )
                  }
                  className="mt-6 border-b-4 border-fnblue/45"
                />
                <NonSrmEditor
                  title="Member Draft"
                  member={draftNonSrm}
                  onChange={(field, value) =>
                    setDraftNonSrm(
                      (prev) => ({ ...prev, [field]: value }) as NonSrmMember,
                    )
                  }
                  className="mt-4 border-b-4 border-fngreen/45"
                />
              </>
            )}

            {editingIndex !== null && (
              <div className="mt-4 rounded-xl border border-b-4 border-fnorange/50 bg-fnorange/10 p-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-foreground/80">
                  Editing Member {editingIndex + 1}
                </p>
                {teamType === "srm" ? (
                  <SrmEditor
                    title="Edit Member"
                    member={editingSrm}
                    onChange={(field, value) =>
                      setEditingSrm(
                        (prev) => ({ ...prev, [field]: value }) as SrmMember,
                      )
                    }
                    className="border-b-4 border-fnorange/45"
                  />
                ) : (
                  <NonSrmEditor
                    title="Edit Member"
                    member={editingNonSrm}
                    onChange={(field, value) =>
                      setEditingNonSrm(
                        (prev) => ({ ...prev, [field]: value }) as NonSrmMember,
                      )
                    }
                    className="border-b-4 border-fnorange/45"
                  />
                )}
                <div className="mt-3 flex gap-2">
                  <FnButton type="button" onClick={saveEditMember} size="sm">
                    Save Member Update
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={cancelEditMember}
                    tone="gray"
                    size="sm"
                  >
                    Cancel
                  </FnButton>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              {formError ? (
                <p className="w-full rounded-md border border-fnred/35 bg-fnred/10 px-3 py-2 text-sm font-semibold text-fnred">
                  {formError}
                </p>
              ) : null}
              <FnButton
                type="button"
                onClick={addMember}
                disabled={!canAddMember || isAssigningStatement}
                tone="green"
              >
                <PlusIcon size={16} strokeWidth={3} />
                Add Member
              </FnButton>
              <FnButton
                type="button"
                onClick={saveChanges}
                loading={isSaving}
                loadingText="Saving..."
                disabled={isSaving || isDeleting || isAssigningStatement}
              >
                Save Changes
              </FnButton>
              <FnButton
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                tone="red"
                disabled={isDeleting || isAssigningStatement}
              >
                <Trash2 size={16} strokeWidth={3} />
                Delete Team
              </FnButton>
            </div>
          </section>

          <aside className="space-y-4 self-start">
            <div className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fngreen">
                Team Identity
              </p>
              <p className="mt-3 text-sm font-semibold">Team: {teamName}</p>
              <p className="text-sm font-semibold">Team ID: {teamId}</p>
              <p className="text-sm font-semibold">
                Lead:{" "}
                {(teamType === "srm" ? leadSrm.name : leadNonSrm.name) || "N/A"}
              </p>
              <p className="text-sm font-semibold">
                Lead ID: {currentLeadId || "N/A"}
              </p>
              {teamType === "non_srm" && (
                <>
                  <p className="text-sm font-semibold">
                    College: {metaNonSrm.collegeName || "N/A"}
                  </p>
                  <p className="text-sm font-semibold">
                    Club:{" "}
                    {metaNonSrm.isClub
                      ? metaNonSrm.clubName || "Club team"
                      : "Independent Team"}
                  </p>
                </>
              )}
              <p className="mt-3 text-xs text-foreground/70">
                Created: {formatDateTime(createdAt)}
              </p>
            </div>

            <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnyellow">
                Members
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-foreground/10 text-left">
                      <th className="py-2 pr-3">Role</th>
                      <th className="py-2 pr-3">Name</th>
                      <th className="py-2 pr-3">
                        {teamType === "srm" ? "NetID" : "College ID"}
                      </th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-foreground/10">
                      <td className="py-2 pr-3 font-bold text-fnblue">Lead</td>
                      <td className="py-2 pr-3">
                        {(teamType === "srm"
                          ? leadSrm.name
                          : leadNonSrm.name) || "-"}
                      </td>
                      <td className="py-2 pr-3">{currentLeadId || "-"}</td>
                      <td className="py-2 text-right text-foreground/40">-</td>
                    </tr>
                    {currentMembers.map((member, idx) => (
                      <tr
                        key={`${getCurrentMemberId(member)}-${idx}`}
                        className="border-b border-foreground/10"
                      >
                        <td className="py-2 pr-3">M{idx + 1}</td>
                        <td className="py-2 pr-3">{member.name}</td>
                        <td className="py-2 pr-3">
                          {getCurrentMemberId(member)}
                        </td>
                        <td className="space-x-1 py-2 text-right">
                          <FnButton
                            type="button"
                            onClick={() => beginEditMember(idx)}
                            size="xs"
                          >
                            <UserRoundPen size={16} strokeWidth={3} />
                          </FnButton>
                          <FnButton
                            type="button"
                            onClick={() => removeMember(idx)}
                            tone="red"
                            size="xs"
                          >
                            <Trash2 size={16} strokeWidth={3} />
                          </FnButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border border-b-4 border-fnorange bg-background/95 p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnorange">
                Actions
              </p>
              <p className="mt-2 text-sm text-foreground/75">
                Review all available statements or continue editing from this
                control panel.
              </p>
              <div className="mt-4">
                <FnButton asChild tone="gray">
                  <Link href="/problem-statements" prefetch={true}>
                    View Problem Statements
                  </Link>
                </FnButton>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-team-title"
        >
          <div className="w-full max-w-md rounded-xl border border-b-4 border-fnred bg-background p-6 shadow-xl">
            <p
              id="delete-team-title"
              className="text-sm uppercase tracking-[0.18em] font-bold text-fnred"
            >
              Confirm Team Deletion
            </p>
            <p className="mt-3 text-sm text-foreground/80">
              This action permanently removes the team record and cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <FnButton
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                tone="gray"
                size="sm"
                disabled={isDeleting}
              >
                Cancel
              </FnButton>
              <FnButton
                type="button"
                onClick={deleteTeam}
                tone="red"
                size="sm"
                loading={isDeleting}
                loadingText="Deleting..."
                disabled={isDeleting}
              >
                <Trash2 size={16} strokeWidth={3} />
                Delete Team
              </FnButton>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

type AccentTone = "blue" | "green" | "yellow" | "orange" | "red";

const ACCENT_TONE_CLASS: Record<AccentTone, string> = {
  blue: "border-fnblue bg-fnblue/10 text-fnblue",
  green: "border-fngreen bg-fngreen/10 text-fngreen",
  orange: "border-fnorange bg-fnorange/10 text-fnorange",
  red: "border-fnred bg-fnred/10 text-fnred",
  yellow: "border-fnyellow bg-fnyellow/20 text-fnyellow",
};

const HighlightTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: AccentTone;
}) => (
  <div className="rounded-lg border border-foreground/12 bg-background/85 p-3 shadow-sm">
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
      {label}
    </p>
    <p
      className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${ACCENT_TONE_CLASS[tone]}`}
    >
      {value}
    </p>
  </div>
);

const StatCard = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: AccentTone;
}) => (
  <div
    className={`rounded-xl border border-b-4 bg-background/95 p-4 shadow-sm ${
      tone === "blue"
        ? "border-fnblue"
        : tone === "green"
          ? "border-fngreen"
          : tone === "yellow"
            ? "border-fnyellow"
            : tone === "orange"
              ? "border-fnorange"
              : "border-fnred"
    }`}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/60">
      {label}
    </p>
    <p className="mt-2 text-base font-black uppercase tracking-[0.05em] md:text-lg">
      {value}
    </p>
  </div>
);

const Input = ({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  minLength,
  maxLength,
  pattern,
}: InputProps) => (
  <label className="block">
    <p className="text-xs uppercase tracking-[0.2em] text-foreground/70 font-semibold mb-1">
      {label}
    </p>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
      className="w-full rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
    />
  </label>
);

const SrmEditor = ({
  title,
  member,
  onChange,
  className = "",
}: {
  title: string;
  member: SrmMember;
  onChange: (field: keyof SrmMember, value: string | number) => void;
  className?: string;
}) => (
  <div
    className={`rounded-xl border border-foreground/12 bg-slate-50 p-4 shadow-sm ${className}`}
  >
    <p className="text-sm font-bold uppercase tracking-[0.08em] mb-3">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="Name"
        value={member.name}
        onChange={(v) => onChange("name", v)}
        required
        minLength={2}
        maxLength={100}
      />
      <Input
        label="RA Number"
        value={member.raNumber}
        onChange={(v) => onChange("raNumber", v)}
        required
        minLength={3}
        maxLength={50}
      />
      <Input
        label="NetID"
        value={member.netId}
        onChange={(v) => onChange("netId", v)}
        required
        minLength={3}
        maxLength={50}
      />
      <Input
        label="Department"
        value={member.dept}
        onChange={(v) => onChange("dept", v)}
        required
        minLength={2}
        maxLength={50}
      />
      <div className="md:col-span-2">
        <NumberInput
          label="Contact"
          value={member.contact}
          onChange={(v) => onChange("contact", v)}
        />
      </div>
    </div>
  </div>
);

const NonSrmEditor = ({
  title,
  member,
  onChange,
  className = "",
}: {
  title: string;
  member: NonSrmMember;
  onChange: (field: keyof NonSrmMember, value: string | number) => void;
  className?: string;
}) => (
  <div
    className={`rounded-xl border border-foreground/12 bg-slate-50 p-4 shadow-sm ${className}`}
  >
    <p className="text-sm font-bold uppercase tracking-[0.08em] mb-3">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="Name"
        value={member.name}
        onChange={(v) => onChange("name", v)}
        required
        minLength={2}
        maxLength={100}
      />
      <Input
        label="College ID Number"
        value={member.collegeId}
        onChange={(v) => onChange("collegeId", v)}
        required
        minLength={3}
        maxLength={50}
      />
      <Input
        label="College Email / Personal Email"
        value={member.collegeEmail}
        onChange={(v) => onChange("collegeEmail", v)}
        type="email"
        required
      />
      <NumberInput
        label="Contact"
        value={member.contact}
        onChange={(v) => onChange("contact", v)}
      />
    </div>
  </div>
);

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

const NumberInput = ({ label, value, onChange }: NumberInputProps) => (
  <label className="block">
    <p className="text-xs uppercase tracking-[0.2em] text-foreground/70 font-semibold mb-1">
      {label}
    </p>
    <input
      type="tel"
      inputMode="numeric"
      pattern="[0-9]{10,15}"
      value={value === 0 ? "" : value}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
      required
      minLength={10}
      maxLength={15}
      className="w-full rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
    />
  </label>
);
