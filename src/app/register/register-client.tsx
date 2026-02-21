"use client";

import { ArrowLeft, PlusIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  teamSubmissionSchema,
} from "@/lib/register-schema";
import { dispatchTeamCreatedEvent } from "@/lib/team-ui-events";

type TeamType = "srm" | "non_srm";

type NonSrmMeta = {
  clubName: string;
  collegeName: string;
  isClub: boolean;
};

type ProblemStatementAvailability = {
  id: string;
  isFull: boolean;
  summary: string;
  title: string;
};

type LockedProblemStatement = {
  id: string;
  lockExpiresAt: string;
  lockedAtIso: string;
  lockToken: string;
  title: string;
};

const MAX_MEMBERS = 5;
const ABANDONED_DRAFT_KEY = "foundathon:register-abandoned";
const LOCK_COUNTDOWN_REFRESH_MS = 1000;

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

const emptyNonSrmMeta = (): NonSrmMeta => ({
  clubName: "",
  collegeName: "",
  isClub: false,
});

const hasDraftSrmInput = (member: SrmMember) =>
  member.name.trim().length > 0 ||
  member.raNumber.trim().length > 0 ||
  member.netId.trim().length > 0 ||
  member.dept.trim().length > 0 ||
  member.contact !== 0;

const hasDraftNonSrmInput = (member: NonSrmMember) =>
  member.name.trim().length > 0 ||
  member.collegeId.trim().length > 0 ||
  member.collegeEmail.trim().length > 0 ||
  member.contact !== 0;

const formatRemainingTime = (remainingMs: number) => {
  if (remainingMs <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const RegisterClient = () => {
  const router = useRouter();
  const { start: startRouteProgress } = useRouteProgress();

  const [step, setStep] = useState<1 | 2>(1);
  const [teamType, setTeamType] = useState<TeamType>("srm");
  const [teamName, setTeamName] = useState("");

  const [leadSrm, setLeadSrm] = useState<SrmMember>(emptySrmMember);
  const [membersSrm, setMembersSrm] = useState<SrmMember[]>([]);
  const [memberDraftSrm, setMemberDraftSrm] =
    useState<SrmMember>(emptySrmMember);

  const [leadNonSrm, setLeadNonSrm] = useState<NonSrmMember>(emptyNonSrmMember);
  const [membersNonSrm, setMembersNonSrm] = useState<NonSrmMember[]>([]);
  const [memberDraftNonSrm, setMemberDraftNonSrm] =
    useState<NonSrmMember>(emptyNonSrmMember);
  const [nonSrmMeta, setNonSrmMeta] = useState<NonSrmMeta>(emptyNonSrmMeta);

  const [problemStatements, setProblemStatements] = useState<
    ProblemStatementAvailability[]
  >([]);
  const [isLoadingStatements, setIsLoadingStatements] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLockingProblemStatementId, setIsLockingProblemStatementId] =
    useState<string | null>(null);
  const [lockedProblemStatement, setLockedProblemStatement] =
    useState<LockedProblemStatement | null>(null);
  const [formValidationError, setFormValidationError] = useState<string | null>(
    null,
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lockNowMs, setLockNowMs] = useState(() => Date.now());

  const hasCreatedTeamRef = useRef(false);
  const hasStartedDraftRef = useRef(false);
  const allowUnmountWarningRef = useRef(false);
  const hasShownExpiredLockToastRef = useRef(false);
  const hasSentAbandonLockEmailRef = useRef(false);
  const notifyProblemStatementAbandonedByEmailRef = useRef<() => void>(
    () => undefined,
  );

  const currentMembers = teamType === "srm" ? membersSrm : membersNonSrm;
  const currentLead = teamType === "srm" ? leadSrm : leadNonSrm;
  const currentLeadId =
    teamType === "srm" ? leadSrm.netId : leadNonSrm.collegeId;
  const memberCount = 1 + currentMembers.length;
  const getCurrentMemberId = (member: SrmMember | NonSrmMember) =>
    teamType === "srm"
      ? (member as SrmMember).netId
      : (member as NonSrmMember).collegeId;

  const canAddMember = memberCount < MAX_MEMBERS;
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
            collegeName: nonSrmMeta.collegeName,
            isClub: nonSrmMeta.isClub,
            clubName: nonSrmMeta.isClub ? nonSrmMeta.clubName : "",
            lead: leadNonSrm,
            members: membersNonSrm,
          },
    [
      leadNonSrm,
      leadSrm,
      membersNonSrm,
      membersSrm,
      nonSrmMeta,
      teamName,
      teamType,
    ],
  );
  const teamPayloadValidation = useMemo(
    () => teamSubmissionSchema.safeParse(teamPayload),
    [teamPayload],
  );
  const canProceed = teamPayloadValidation.success;
  const lockExpiryMs = lockedProblemStatement
    ? new Date(lockedProblemStatement.lockExpiresAt).getTime()
    : null;
  const isLockExpired = lockExpiryMs !== null && lockExpiryMs <= lockNowMs;
  const lockCountdownLabel =
    lockExpiryMs === null
      ? "N/A"
      : formatRemainingTime(lockExpiryMs - lockNowMs);
  const canCreateTeam =
    canProceed && Boolean(lockedProblemStatement) && !isLockExpired;

  const completedProfiles = useMemo(() => {
    if (teamType === "srm") {
      const leadOk = srmMemberSchema.safeParse(leadSrm).success ? 1 : 0;
      const membersOk = membersSrm.filter(
        (item) => srmMemberSchema.safeParse(item).success,
      ).length;
      return leadOk + membersOk;
    }

    const leadOk = nonSrmMemberSchema.safeParse(leadNonSrm).success ? 1 : 0;
    const membersOk = membersNonSrm.filter(
      (item) => nonSrmMemberSchema.safeParse(item).success,
    ).length;
    return leadOk + membersOk;
  }, [leadNonSrm, leadSrm, membersNonSrm, membersSrm, teamType]);

  const hasStartedDraft = useMemo(
    () =>
      teamName.trim().length > 0 ||
      membersSrm.length > 0 ||
      membersNonSrm.length > 0 ||
      hasDraftSrmInput(leadSrm) ||
      hasDraftSrmInput(memberDraftSrm) ||
      hasDraftNonSrmInput(leadNonSrm) ||
      hasDraftNonSrmInput(memberDraftNonSrm) ||
      nonSrmMeta.collegeName.trim().length > 0 ||
      nonSrmMeta.clubName.trim().length > 0 ||
      nonSrmMeta.isClub ||
      step === 2 ||
      Boolean(lockedProblemStatement),
    [
      leadNonSrm,
      leadSrm,
      lockedProblemStatement,
      memberDraftNonSrm,
      memberDraftSrm,
      membersNonSrm.length,
      membersSrm.length,
      nonSrmMeta.clubName,
      nonSrmMeta.collegeName,
      nonSrmMeta.isClub,
      step,
      teamName,
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
    if (step === 2) {
      void loadProblemStatements();
    }
  }, [loadProblemStatements, step]);

  useEffect(() => {
    if (!lockedProblemStatement) {
      hasShownExpiredLockToastRef.current = false;
      return;
    }

    const intervalId = window.setInterval(() => {
      setLockNowMs(Date.now());
    }, LOCK_COUNTDOWN_REFRESH_MS);

    return () => window.clearInterval(intervalId);
  }, [lockedProblemStatement]);

  useEffect(() => {
    if (!lockedProblemStatement || !isLockExpired) {
      return;
    }

    if (!hasShownExpiredLockToastRef.current) {
      hasShownExpiredLockToastRef.current = true;
      toast({
        title: "Statement Lock Expired",
        description:
          "Your previous lock token expired. Please lock a statement again to continue.",
        variant: "destructive",
      });
    }

    setLockedProblemStatement(null);
    hasSentAbandonLockEmailRef.current = false;
    void loadProblemStatements();
  }, [isLockExpired, loadProblemStatements, lockedProblemStatement]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const abandonedDraft = window.localStorage.getItem(ABANDONED_DRAFT_KEY);
    if (abandonedDraft !== "1") {
      return;
    }

    window.localStorage.removeItem(ABANDONED_DRAFT_KEY);
    toast({
      title: "Team Was Not Created",
      description:
        "Your previous onboarding draft was abandoned before team creation.",
      variant: "destructive",
    });
  }, []);

  useEffect(() => {
    hasStartedDraftRef.current = hasStartedDraft;
  }, [hasStartedDraft]);

  useEffect(() => {
    if (teamPayloadValidation.success && formValidationError) {
      setFormValidationError(null);
    }
  }, [formValidationError, teamPayloadValidation.success]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timer = window.setTimeout(() => {
      allowUnmountWarningRef.current = true;
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleBeforeUnload = () => {
      if (!hasStartedDraftRef.current || hasCreatedTeamRef.current) {
        return;
      }

      window.localStorage.setItem(ABANDONED_DRAFT_KEY, "1");
      notifyProblemStatementAbandonedByEmailRef.current();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (!allowUnmountWarningRef.current) {
        return;
      }

      if (!hasStartedDraftRef.current || hasCreatedTeamRef.current) {
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(ABANDONED_DRAFT_KEY, "1");
      }
      notifyProblemStatementAbandonedByEmailRef.current();

      toast({
        title: "Team Was Not Created",
        description: "You exited onboarding before creating your team.",
        variant: "destructive",
      });
    };
  }, []);

  const updateSrmLead = (field: keyof SrmMember, value: string | number) => {
    setLeadSrm((prev) => ({ ...prev, [field]: value }) as SrmMember);
  };

  const updateSrmDraft = (field: keyof SrmMember, value: string | number) => {
    setMemberDraftSrm((prev) => ({ ...prev, [field]: value }) as SrmMember);
  };

  const updateNonSrmLead = (
    field: keyof NonSrmMember,
    value: string | number,
  ) => {
    setLeadNonSrm((prev) => ({ ...prev, [field]: value }) as NonSrmMember);
  };

  const updateNonSrmDraft = (
    field: keyof NonSrmMember,
    value: string | number,
  ) => {
    setMemberDraftNonSrm(
      (prev) => ({ ...prev, [field]: value }) as NonSrmMember,
    );
  };

  const addMember = () => {
    if (!canAddMember) return;

    if (teamType === "srm") {
      const parsed = srmMemberSchema.safeParse(memberDraftSrm);
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
      setMemberDraftSrm(emptySrmMember());
    } else {
      const parsed = nonSrmMemberSchema.safeParse(memberDraftNonSrm);
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
      setMemberDraftNonSrm(emptyNonSrmMember());
    }

    toast({
      title: "Member Added to Draft",
      description: "Member is added successfully.",
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

  const clearCurrentTeam = () => {
    setShowClearConfirm(false);
    setFormValidationError(null);
    setStep(1);
    setTeamName("");
    setLockedProblemStatement(null);
    hasSentAbandonLockEmailRef.current = false;
    setProblemStatements([]);

    if (teamType === "srm") {
      setLeadSrm(emptySrmMember());
      setMemberDraftSrm(emptySrmMember());
      setMembersSrm([]);
    } else {
      setLeadNonSrm(emptyNonSrmMember());
      setMemberDraftNonSrm(emptyNonSrmMember());
      setMembersNonSrm([]);
      setNonSrmMeta(emptyNonSrmMeta());
    }

    toast({
      title: "Form Reset Complete",
      description:
        "Current team details were cleared. You can start onboarding again.",
      variant: "success",
    });
  };

  const validateTeamPayload = () => {
    if (!teamPayloadValidation.success) {
      const message =
        teamPayloadValidation.error.issues[0]?.message ??
        "Please fix the team details and try again.";
      setFormValidationError(message);
      toast({
        title: "Team Details Invalid",
        description: message,
        variant: "destructive",
      });
      return null;
    }

    setFormValidationError(null);
    return teamPayloadValidation.data;
  };

  const goToProblemStatementsStep = () => {
    const parsed = validateTeamPayload();
    if (!parsed) {
      return;
    }

    setFormValidationError(null);
    setStep(2);
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

  const notifyProblemStatementAbandonedByEmail = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (hasSentAbandonLockEmailRef.current || hasCreatedTeamRef.current) {
      return;
    }

    if (!lockedProblemStatement) {
      return;
    }

    const lockExpiresAtMs = new Date(
      lockedProblemStatement.lockExpiresAt,
    ).getTime();
    if (!Number.isFinite(lockExpiresAtMs) || lockExpiresAtMs <= Date.now()) {
      return;
    }

    const leadName =
      teamType === "srm" ? leadSrm.name.trim() : leadNonSrm.name.trim();
    const leadEmail =
      teamType === "srm"
        ? toSrmLeadEmail(leadSrm.netId)
        : leadNonSrm.collegeEmail.trim().toLowerCase();
    if (!leadName || !isValidEmailAddress(leadEmail)) {
      return;
    }

    const abandonedAtIso = new Date().toISOString();
    const payload: ProblemLockEmailPayload = {
      abandonedAtIso,
      leadEmail,
      leadName,
      lockExpiresAtIso: lockedProblemStatement.lockExpiresAt,
      lockedAtIso: lockedProblemStatement.lockedAtIso,
      notificationType: "lock_abandoned",
      problemStatementId: lockedProblemStatement.id,
      problemStatementSummary: findProblemStatementSummary(
        problemStatements,
        lockedProblemStatement.id,
      ),
      problemStatementTitle: lockedProblemStatement.title,
      teamName: teamName.trim() || "Unnamed Team",
    };
    const serializedPayload = JSON.stringify(payload);

    let beaconQueued = false;
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      beaconQueued = navigator.sendBeacon(
        "/api/send",
        new Blob([serializedPayload], {
          type: "application/json",
        }),
      );
    }

    if (!beaconQueued) {
      void fetch("/api/send", {
        body: serializedPayload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        method: "POST",
      }).catch(() => undefined);
    }

    hasSentAbandonLockEmailRef.current = true;
  }, [
    leadNonSrm.collegeEmail,
    leadNonSrm.name,
    leadSrm.name,
    leadSrm.netId,
    lockedProblemStatement,
    problemStatements,
    teamName,
    teamType,
  ]);

  useEffect(() => {
    notifyProblemStatementAbandonedByEmailRef.current =
      notifyProblemStatementAbandonedByEmail;
  }, [notifyProblemStatementAbandonedByEmail]);

  const lockProblemStatement = async (problemStatementId: string) => {
    if (lockedProblemStatement) {
      return;
    }

    setIsLockingProblemStatementId(problemStatementId);

    try {
      const response = await fetch("/api/problem-statements/lock", {
        body: JSON.stringify({ problemStatementId }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = (await response.json()) as {
        error?: string;
        lockExpiresAt?: string;
        lockToken?: string;
        locked?: boolean;
        problemStatement?: { id: string; title: string };
      };

      if (
        !response.ok ||
        !data.locked ||
        !data.lockToken ||
        !data.lockExpiresAt ||
        !data.problemStatement
      ) {
        toast({
          title: "Could Not Lock Problem Statement",
          description:
            data.error ??
            "We couldn't lock this statement. Please try another one.",
          variant: "destructive",
        });
        return;
      }

      const lockedAtIso = new Date().toISOString();
      setLockedProblemStatement({
        id: data.problemStatement.id,
        lockExpiresAt: data.lockExpiresAt,
        lockedAtIso,
        lockToken: data.lockToken,
        title: data.problemStatement.title,
      });
      hasSentAbandonLockEmailRef.current = false;

      const emailResult = await notifyProblemStatementLockByEmail({
        lockExpiresAtIso: data.lockExpiresAt,
        lockedAtIso,
        problemStatementId: data.problemStatement.id,
        problemStatementTitle: data.problemStatement.title,
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
    } catch {
      toast({
        title: "Lock Request Failed",
        description:
          "Network issue while locking the statement. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLockingProblemStatementId(null);
    }
  };

  const createTeam = async () => {
    const parsedTeam = validateTeamPayload();
    if (!parsedTeam) {
      return;
    }

    if (!lockedProblemStatement) {
      toast({
        title: "Problem Statement Not Locked",
        description: "Lock a problem statement before creating your team.",
        variant: "destructive",
      });
      return;
    }

    if (isLockExpired) {
      toast({
        title: "Statement Lock Expired",
        description:
          "Your lock has expired. Lock a problem statement again to continue.",
        variant: "destructive",
      });
      setLockedProblemStatement(null);
      return;
    }

    setIsCreatingTeam(true);
    setIsRedirecting(false);
    let isNavigating = false;

    try {
      const response = await fetch("/api/register", {
        body: JSON.stringify({
          lockToken: lockedProblemStatement.lockToken,
          problemStatementId: lockedProblemStatement.id,
          team: parsedTeam,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      const data = (await response.json()) as {
        error?: string;
        team?: { id: string };
      };

      if (!response.ok || !data.team?.id) {
        toast({
          title: "Team Registration Failed",
          description:
            data.error ??
            "We couldn't create your team registration. Please try again.",
          variant: "destructive",
        });
        return;
      }

      hasCreatedTeamRef.current = true;

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(ABANDONED_DRAFT_KEY);
      }

      dispatchTeamCreatedEvent(data.team.id);
      setIsRedirecting(true);
      isNavigating = true;
      startRouteProgress();
      router.push(`/dashboard/${data.team.id}`);
    } catch {
      setIsRedirecting(false);
      toast({
        title: "Create Team Request Failed",
        description:
          "Network issue while creating your team. Check your connection and retry.",
        variant: "destructive",
      });
    } finally {
      if (!isNavigating) {
        setIsCreatingTeam(false);
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-45 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="fncontainer relative py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border bg-background/95 p-6 md:p-8 shadow-lg border-b-4 border-fnblue backdrop-blur-sm">
            <div className="space-y-4">
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                onboarding wizard
              </h1>
              <p className="text-foreground/70">
                Enter team details, lock one problem statement, and create your
                team.
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  {
                    label: "1. Team Details",
                    tone:
                      step === 1
                        ? "border-fnblue bg-fnblue text-white"
                        : "border-fnblue/40 bg-fnblue/10",
                  },
                  {
                    label: "2. Lock Statement",
                    tone:
                      step === 2
                        ? "border-fngreen bg-fngreen text-white"
                        : "border-fngreen/40 bg-fngreen/10",
                  },
                  {
                    label: "3. Create Team",
                    tone: lockedProblemStatement
                      ? "border-fnyellow bg-fnyellow/30"
                      : "border-fnyellow/45 bg-fnyellow/20",
                  },
                ].map((progressStep) => (
                  <p
                    key={progressStep.label}
                    className={`rounded-md border px-2 py-2 text-[10px] uppercase tracking-[0.16em] font-bold ${progressStep.tone}`}
                  >
                    {progressStep.label}
                  </p>
                ))}
              </div>
            </div>

            {step === 1 ? (
              <>
                <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 shadow-sm">
                  <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3 text-fnblue">
                    Team Type
                  </p>
                  <label className="block">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/70 font-semibold mb-2">
                      Select Team Category
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setTeamType("srm")}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.08em] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-fnblue/50 ${
                          teamType === "srm"
                            ? "border-fnblue bg-fnblue text-white"
                            : "border-fnblue/35 bg-white text-foreground hover:bg-fnblue/10"
                        }`}
                      >
                        SRM
                      </button>
                      <button
                        type="button"
                        onClick={() => setTeamType("non_srm")}
                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.08em] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-fnblue/50 ${
                          teamType === "non_srm"
                            ? "border-fnblue bg-fnblue text-white"
                            : "border-fnblue/35 bg-white text-foreground hover:bg-fnblue/10"
                        }`}
                      >
                        Non-SRM
                      </button>
                    </div>
                  </label>
                </div>

                <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
                  <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3 text-fnblue">
                    Team Identity
                  </p>
                  <Input
                    label="Team Name"
                    value={teamName}
                    onChange={setTeamName}
                  />
                </div>

                {teamType === "non_srm" && (
                  <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
                    <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3 text-fnblue">
                      Non-SRM Team Info
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="College Name"
                        value={nonSrmMeta.collegeName}
                        onChange={(value) =>
                          setNonSrmMeta((prev) => ({
                            ...prev,
                            collegeName: value,
                          }))
                        }
                      />
                    </div>
                    <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={nonSrmMeta.isClub}
                        onChange={(event) =>
                          setNonSrmMeta((prev) => ({
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
                        label="Club Name (or empty)"
                        value={nonSrmMeta.clubName}
                        onChange={(value) =>
                          setNonSrmMeta((prev) => ({
                            ...prev,
                            clubName: value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {teamType === "srm" ? (
                  <>
                    <SrmMemberEditor
                      title="Team Lead"
                      member={leadSrm}
                      onChange={updateSrmLead}
                      className="mt-6"
                    />
                    <MemberDraftCard
                      canAddMember={canAddMember}
                      onAdd={addMember}
                      count={membersSrm.length + 2}
                    >
                      <SrmMemberEditor
                        title={`Member Draft (${membersSrm.length + 2})`}
                        member={memberDraftSrm}
                        onChange={updateSrmDraft}
                      />
                    </MemberDraftCard>
                  </>
                ) : (
                  <>
                    <NonSrmMemberEditor
                      title="Team Lead"
                      member={leadNonSrm}
                      onChange={updateNonSrmLead}
                      className="mt-6"
                    />
                    <MemberDraftCard
                      canAddMember={canAddMember}
                      onAdd={addMember}
                      count={membersNonSrm.length + 2}
                    >
                      <NonSrmMemberEditor
                        title={`Member Draft (${membersNonSrm.length + 2})`}
                        member={memberDraftNonSrm}
                        onChange={updateNonSrmDraft}
                      />
                    </MemberDraftCard>
                  </>
                )}

                <p className="mt-4 text-xs uppercase tracking-[0.18em] font-semibold text-foreground/70">
                  Team size required: 3 to 5 (including lead)
                </p>
                {formValidationError ? (
                  <p className="mt-2 rounded-md border border-fnred/35 bg-fnred/10 px-3 py-2 text-sm font-semibold text-fnred">
                    {formValidationError}
                  </p>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                  <FnButton
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    tone="gray"
                    disabled={isCreatingTeam || isRedirecting}
                  >
                    Clear
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={goToProblemStatementsStep}
                    disabled={!canProceed || isCreatingTeam || isRedirecting}
                  >
                    Next
                  </FnButton>
                </div>
              </>
            ) : (
              <>
                <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] text-fnblue">
                      Lock Problem Statement
                    </p>
                    <p className="text-xs uppercase tracking-[0.16em] text-foreground/70 font-semibold">
                      Single lock per onboarding draft
                    </p>
                  </div>
                  <p className="mt-2 text-sm text-foreground/70">
                    Lock one statement to continue.
                  </p>
                </div>

                {lockedProblemStatement && (
                  <div className="mt-4 rounded-xl border border-fngreen/35 bg-fngreen/12 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-fngreen font-semibold">
                      Locked Statement
                    </p>
                    <p className="mt-1 font-bold">
                      {lockedProblemStatement.title}
                    </p>
                    <p className="text-xs text-foreground/70 mt-1">
                      Lock expires in {lockCountdownLabel}
                    </p>
                    <p className="text-xs text-foreground/60 mt-1">
                      Expires at{" "}
                      {new Date(
                        lockedProblemStatement.lockExpiresAt,
                      ).toLocaleString()}
                    </p>
                  </div>
                )}

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {isLoadingStatements &&
                    ["one", "two", "three", "four"].map((skeletonKey) => (
                      <div
                        key={`statement-skeleton-${skeletonKey}`}
                        className="h-40 animate-pulse rounded-xl border border-foreground/15 bg-foreground/5"
                      />
                    ))}

                  {!isLoadingStatements &&
                    problemStatements.map((statement) => {
                      const isLockedCard =
                        lockedProblemStatement?.id === statement.id;
                      const lockDisabled =
                        Boolean(lockedProblemStatement) ||
                        statement.isFull ||
                        isCreatingTeam ||
                        isRedirecting;

                      return (
                        <div
                          key={statement.id}
                          className="rounded-xl border border-foreground/12 bg-white p-4 shadow-sm"
                        >
                          <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-fnblue">
                            {statement.id}
                          </p>
                          <h3 className="mt-2 text-base font-black uppercase tracking-tight">
                            {statement.title}
                          </h3>
                          <p className="mt-2 text-sm text-foreground/75 leading-relaxed">
                            {statement.summary}
                          </p>

                          <div className="mt-4">
                            {isLockedCard ? (
                              <FnButton type="button" tone="green" disabled>
                                Locked
                              </FnButton>
                            ) : statement.isFull ? (
                              <FnButton type="button" tone="gray" disabled>
                                Full
                              </FnButton>
                            ) : (
                              <FnButton
                                type="button"
                                onClick={() =>
                                  lockProblemStatement(statement.id)
                                }
                                disabled={lockDisabled}
                                loading={
                                  isLockingProblemStatementId === statement.id
                                }
                                loadingText="Locking..."
                              >
                                Lock Problem Statement
                              </FnButton>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                {!isLoadingStatements && problemStatements.length === 0 && (
                  <p className="mt-6 text-sm text-foreground/70">
                    Problem statements are unavailable right now. Please retry.
                  </p>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  <FnButton
                    type="button"
                    onClick={() => setStep(1)}
                    tone="gray"
                    disabled={isCreatingTeam || isRedirecting}
                  >
                    <ArrowLeft size={16} strokeWidth={3} />
                    Back
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={createTeam}
                    disabled={!canCreateTeam || isCreatingTeam || isRedirecting}
                    loading={isCreatingTeam || isRedirecting}
                    loadingText={
                      isRedirecting ? "Redirecting..." : "Creating Team..."
                    }
                  >
                    Create Team
                  </FnButton>
                </div>
              </>
            )}
          </section>

          <aside className="space-y-4 lg:sticky lg:top-10 self-start pr-1">
            <div className="rounded-2xl border bg-background/95 p-6 shadow-md border-b-4 border-fnyellow backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-foreground/70 font-semibold">
                Team Status
              </p>
              <h3 className="text-2xl font-black uppercase tracking-tight mt-2">
                live progress
              </h3>
              <div className="mt-4 space-y-3">
                <StatusLine
                  label="Onboarding Step"
                  value={step === 1 ? "Team Details" : "Problem Lock"}
                  tone="blue"
                />
                <StatusLine
                  label="Team Name"
                  value={teamName || "N/A"}
                  tone="blue"
                />
                <StatusLine
                  label="Members"
                  value={`${memberCount}/${MAX_MEMBERS}`}
                  tone="orange"
                />
                <StatusLine
                  label="Completed Profiles"
                  value={`${completedProfiles}/${memberCount}`}
                  tone="green"
                />
                <StatusLine
                  label="Statement Lock"
                  value={lockedProblemStatement ? "Locked" : "Pending"}
                  tone={lockedProblemStatement ? "green" : "red"}
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-background/95 p-6 shadow-md border-b-4 border-fnblue backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-foreground/70 font-semibold">
                Live Team Members
              </p>
              <p className="text-sm text-foreground/70 mt-1">
                Manage members directly from this table.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-foreground/10">
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.12em] text-xs">
                        Role
                      </th>
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.12em] text-xs">
                        Name
                      </th>
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.12em] text-xs">
                        {teamType === "srm" ? "NetID" : "College ID"}
                      </th>
                      <th className="py-2 font-semibold uppercase tracking-[0.12em] text-xs">
                        Contact
                      </th>
                      <th className="py-2 pl-2 text-right font-semibold uppercase tracking-[0.12em] text-xs">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-foreground/10">
                      <td className="py-2 pr-3 font-bold text-fnblue">Lead</td>
                      <td className="py-2 pr-3">{currentLead.name || "-"}</td>
                      <td className="py-2 pr-3">{currentLeadId || "-"}</td>
                      <td className="py-2">{currentLead.contact || "-"}</td>
                      <td className="py-2 pl-2 text-right text-foreground/40">
                        -
                      </td>
                    </tr>
                    {currentMembers.map((member, index) => (
                      <tr
                        key={`${getCurrentMemberId(member)}-${index}`}
                        className="border-b border-foreground/10"
                      >
                        <td className="py-2 pr-3 font-semibold">
                          M{index + 1}
                        </td>
                        <td className="py-2 pr-3">{member.name}</td>
                        <td className="py-2 pr-3">
                          {getCurrentMemberId(member)}
                        </td>
                        <td className="py-2">{member.contact}</td>
                        <td className="py-2 pl-2 text-right">
                          <FnButton
                            type="button"
                            onClick={() => removeMember(index)}
                            tone="red"
                            size="xs"
                            title="Remove Member"
                            className="cursor-pointer"
                          >
                            <Trash2 size={16} strokeWidth={3} />
                          </FnButton>
                        </td>
                      </tr>
                    ))}
                    {currentMembers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-3 text-foreground/60 text-center"
                        >
                          No members added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showClearConfirm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-team-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-b-4 border-fnred bg-background p-6 shadow-2xl">
            <p
              id="clear-team-title"
              className="text-sm font-bold uppercase tracking-[0.18em] text-fnred"
            >
              Clear Onboarding Draft
            </p>
            <p className="mt-3 text-sm text-foreground/80">
              This will remove all current team details from the form. You can
              start again immediately.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <FnButton
                type="button"
                onClick={() => setShowClearConfirm(false)}
                tone="gray"
                size="sm"
              >
                Cancel
              </FnButton>
              <FnButton
                type="button"
                onClick={clearCurrentTeam}
                tone="red"
                size="sm"
              >
                Clear Draft
              </FnButton>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

const MemberDraftCard = ({
  canAddMember,
  onAdd,
  count,
  children,
}: {
  canAddMember: boolean;
  onAdd: () => void;
  count: number;
  children: ReactNode;
}) => (
  <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3 mb-3 h-13">
      <p className="text-base font-bold uppercase tracking-[0.08em]">
        Add Member Individually
      </p>
      <FnButton
        type="button"
        onClick={onAdd}
        disabled={!canAddMember}
        tone="green"
        size="sm"
        className="cursor-pointer"
      >
        <PlusIcon size={16} strokeWidth={3} />
        Add Member
      </FnButton>
    </div>
    {children}
    <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-semibold text-foreground/60">
      Next member slot: {count}
    </p>
  </div>
);

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
      className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
    />
  </label>
);

type SrmEditorProps = {
  title: string;
  member: SrmMember;
  onChange: (field: keyof SrmMember, value: string | number) => void;
  className?: string;
};

const SrmMemberEditor = ({
  title,
  member,
  onChange,
  className = "",
}: SrmEditorProps) => (
  <div
    className={`rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm ${className}`}
  >
    <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="Name"
        value={member.name}
        onChange={(v) => onChange("name", v)}
      />
      <Input
        label="Registration Number"
        value={member.raNumber}
        onChange={(v) => onChange("raNumber", v)}
      />
      <Input
        label="NetID"
        value={member.netId}
        onChange={(v) => onChange("netId", v)}
      />
      <Input
        label="Department"
        value={member.dept}
        onChange={(v) => onChange("dept", v)}
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

type NonSrmEditorProps = {
  title: string;
  member: NonSrmMember;
  onChange: (field: keyof NonSrmMember, value: string | number) => void;
  className?: string;
};

const NonSrmMemberEditor = ({
  title,
  member,
  onChange,
  className = "",
}: NonSrmEditorProps) => (
  <div
    className={`rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm ${className}`}
  >
    <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3">
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
      className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
    />
  </label>
);

const StatusLine = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "yellow" | "red" | "orange";
}) => {
  const toneClass = {
    blue: "border-fnblue/35 bg-fnblue/10 text-fnblue",
    green: "border-fngreen/35 bg-fngreen/10 text-fngreen",
    yellow: "border-fnyellow/45 bg-fnyellow/20 text-fnyellow",
    red: "border-fnred/35 bg-fnred/10 text-fnred",
    orange: "border-fnorange/35 bg-fnorange/10 text-fnorange",
  }[tone];

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 ${toneClass}`}
    >
      <p className="text-xs uppercase tracking-[0.18em] font-semibold">
        {label}
      </p>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
};

export default RegisterClient;
