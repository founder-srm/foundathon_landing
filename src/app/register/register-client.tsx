"use client";

import { ArrowLeft, PlusIcon, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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
import { InView } from "@/components/ui/in-view";
import ModalPortal from "@/components/ui/modal-portal";
import { useMotionPreferences } from "@/components/ui/motion-preferences";
import { useRouteProgress } from "@/components/ui/route-progress";
import { toast } from "@/hooks/use-toast";
import {
  MOTION_TRANSITIONS,
  MOTION_VARIANTS,
} from "@/lib/motion-system";
import {
  type NonSrmMember,
  nonSrmMemberSchema,
  SRM_MAJOR_DEPARTMENTS,
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

type PendingLockProblemStatement = {
  id: string;
  title: string;
};
type ConfirmationStep = "confirm" | "type";

const MAX_MEMBERS = 5;
const ABANDONED_DRAFT_KEY = "foundathon:register-abandoned";
const LOCK_COUNTDOWN_REFRESH_MS = 1000;
const STEP1_ERROR_SUMMARY_ID = "register-step1-error-summary";
const STEP1_ADD_MEMBER_BUTTON_ID = "register-step1-add-member-button";
const SRM_DEPARTMENT_DATALIST_ID = "srm-major-departments-register";
const STEP1_INPUT_IDS = {
  clubName: "register-step1-club-name",
  collegeName: "register-step1-college-name",
  leadNonSrmCollegeEmail: "register-step1-lead-non-srm-college-email",
  leadNonSrmCollegeId: "register-step1-lead-non-srm-college-id",
  leadNonSrmContact: "register-step1-lead-non-srm-contact",
  leadNonSrmName: "register-step1-lead-non-srm-name",
  leadSrmContact: "register-step1-lead-srm-contact",
  leadSrmDept: "register-step1-lead-srm-dept",
  leadSrmName: "register-step1-lead-srm-name",
  leadSrmNetId: "register-step1-lead-srm-net-id",
  leadSrmRaNumber: "register-step1-lead-srm-ra-number",
  teamName: "register-step1-team-name",
} as const;
const STEP1_ERROR_FOCUS_ORDER = [
  "teamName",
  "lead.name",
  "lead.raNumber",
  "lead.netId",
  "lead.collegeId",
  "lead.collegeEmail",
  "lead.dept",
  "lead.contact",
  "members",
  "collegeName",
  "clubName",
] as const;
const STEP1_LEAD_PATH_PREFIX = "lead.";
const PANEL_TRANSITION = {
  ...MOTION_TRANSITIONS.base,
  ease: MOTION_TRANSITIONS.xl.ease,
} as const;
const STEP_PANEL_VARIANTS = {
  ...MOTION_VARIANTS.modalInOut,
} as const;
const SCROLL_FLOW_VARIANTS = {
  ...MOTION_VARIANTS.fadeLiftIn,
} as const;
const SCROLL_FLOW_VIEW_OPTIONS = {
  margin: "0px 0px -14% 0px",
} as const;

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

const normalizeConfirmationText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

type Step1ValidationFeedback = {
  errorsByPath: Record<string, string>;
  firstInvalidPath: string | null;
  firstIssueMessage: string;
  summaryErrors: string[];
};

type Step1ValidationIssue = {
  message: string;
  path: ReadonlyArray<PropertyKey>;
};

const getStep1IssuePath = (path: ReadonlyArray<PropertyKey>) => {
  const [head, second] = path;

  if (head === "lead" && typeof second === "string") {
    return `lead.${second}`;
  }

  if (head === "members") {
    return "members";
  }

  if (
    head === "teamName" ||
    head === "collegeName" ||
    head === "clubName" ||
    head === "lead"
  ) {
    return head;
  }

  return "team";
};

const buildStep1ValidationFeedback = (
  issues: ReadonlyArray<Step1ValidationIssue>,
): Step1ValidationFeedback => {
  const errorsByPath: Record<string, string> = {};

  for (const issue of issues) {
    const issuePath = getStep1IssuePath(issue.path);
    if (!errorsByPath[issuePath]) {
      errorsByPath[issuePath] = issue.message;
    }
  }

  const hasLeadErrors = Object.keys(errorsByPath).some((pathKey) =>
    pathKey.startsWith(STEP1_LEAD_PATH_PREFIX),
  );

  const summaryErrors: string[] = [];
  if (errorsByPath.teamName) {
    summaryErrors.push(errorsByPath.teamName);
  }
  if (hasLeadErrors) {
    summaryErrors.push(
      "Lead details are incomplete or invalid. Fix highlighted lead fields to continue.",
    );
  }
  if (errorsByPath.members) {
    summaryErrors.push(errorsByPath.members);
  }
  if (errorsByPath.collegeName) {
    summaryErrors.push(errorsByPath.collegeName);
  }
  if (errorsByPath.clubName) {
    summaryErrors.push(errorsByPath.clubName);
  }
  if (!summaryErrors.length && issues[0]?.message) {
    summaryErrors.push(issues[0].message);
  }

  const firstInvalidPath =
    STEP1_ERROR_FOCUS_ORDER.find((pathKey) => Boolean(errorsByPath[pathKey])) ??
    Object.keys(errorsByPath)[0] ??
    null;

  return {
    errorsByPath,
    firstInvalidPath,
    firstIssueMessage:
      issues[0]?.message ?? "Please fix the team details and try again.",
    summaryErrors: [...new Set(summaryErrors)],
  };
};

const getStep1TargetIdByPath = (path: string | null, teamType: TeamType) => {
  if (!path) {
    return STEP1_ERROR_SUMMARY_ID;
  }

  if (path === "teamName") {
    return STEP1_INPUT_IDS.teamName;
  }

  if (path === "members") {
    return STEP1_ADD_MEMBER_BUTTON_ID;
  }

  if (path === "collegeName") {
    return STEP1_INPUT_IDS.collegeName;
  }

  if (path === "clubName") {
    return STEP1_INPUT_IDS.clubName;
  }

  if (teamType === "srm") {
    if (path === "lead.name") return STEP1_INPUT_IDS.leadSrmName;
    if (path === "lead.raNumber") return STEP1_INPUT_IDS.leadSrmRaNumber;
    if (path === "lead.netId") return STEP1_INPUT_IDS.leadSrmNetId;
    if (path === "lead.dept") return STEP1_INPUT_IDS.leadSrmDept;
    if (path === "lead.contact") return STEP1_INPUT_IDS.leadSrmContact;
    if (path === "lead") return STEP1_INPUT_IDS.leadSrmName;
    return STEP1_ERROR_SUMMARY_ID;
  }

  if (path === "lead.name") return STEP1_INPUT_IDS.leadNonSrmName;
  if (path === "lead.collegeId") return STEP1_INPUT_IDS.leadNonSrmCollegeId;
  if (path === "lead.collegeEmail")
    return STEP1_INPUT_IDS.leadNonSrmCollegeEmail;
  if (path === "lead.contact") return STEP1_INPUT_IDS.leadNonSrmContact;
  if (path === "lead") return STEP1_INPUT_IDS.leadNonSrmName;
  return STEP1_ERROR_SUMMARY_ID;
};

const RegisterClient = () => {
  const router = useRouter();
  const { resolved } = useMotionPreferences();
  const { start: startRouteProgress } = useRouteProgress();
  const isReducedMotion = resolved === "reduced";

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
  const [statementsLoadError, setStatementsLoadError] = useState<string | null>(
    null,
  );
  const [isStatementsAuthError, setIsStatementsAuthError] = useState(false);
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isLockingProblemStatementId, setIsLockingProblemStatementId] =
    useState<string | null>(null);
  const [lockedProblemStatement, setLockedProblemStatement] =
    useState<LockedProblemStatement | null>(null);
  const [formValidationError, setFormValidationError] = useState<string | null>(
    null,
  );
  const [hasAttemptedStep1Submit, setHasAttemptedStep1Submit] = useState(false);
  const [step1ErrorsByPath, setStep1ErrorsByPath] = useState<
    Record<string, string>
  >({});
  const [step1SummaryErrors, setStep1SummaryErrors] = useState<string[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pendingLockProblemStatement, setPendingLockProblemStatement] =
    useState<PendingLockProblemStatement | null>(null);
  const [lockConfirmationStep, setLockConfirmationStep] =
    useState<ConfirmationStep>("confirm");
  const [lockConfirmationInput, setLockConfirmationInput] = useState("");
  const [lockNowMs, setLockNowMs] = useState(() => Date.now());

  const hasCreatedTeamRef = useRef(false);
  const hasStartedDraftRef = useRef(false);
  const allowUnmountWarningRef = useRef(false);
  const hasShownExpiredLockToastRef = useRef(false);

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
  const lockConfirmationPhrase = pendingLockProblemStatement
    ? `lock ${pendingLockProblemStatement.title}`
    : "";
  const normalizedLockConfirmationInput = normalizeConfirmationText(
    lockConfirmationInput,
  );
  const normalizedLockConfirmationPhrase = normalizeConfirmationText(
    lockConfirmationPhrase,
  );
  const normalizedQuotedLockConfirmationPhrase = normalizeConfirmationText(
    `"${lockConfirmationPhrase}"`,
  );
  const canConfirmProblemStatementLock =
    Boolean(pendingLockProblemStatement) &&
    (normalizedLockConfirmationInput === normalizedLockConfirmationPhrase ||
      normalizedLockConfirmationInput === normalizedQuotedLockConfirmationPhrase);
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
  const lockExpiryMs = lockedProblemStatement
    ? new Date(lockedProblemStatement.lockExpiresAt).getTime()
    : null;
  const isLockExpired = lockExpiryMs !== null && lockExpiryMs <= lockNowMs;
  const lockCountdownLabel =
    lockExpiryMs === null
      ? "N/A"
      : formatRemainingTime(lockExpiryMs - lockNowMs);
  const canCreateTeam =
    teamPayloadValidation.success &&
    Boolean(lockedProblemStatement) &&
    !isLockExpired;
  const signInToRegisterHref = useMemo(
    () => `/api/auth/login?next=${encodeURIComponent("/register")}`,
    [],
  );

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

  const step1LeadSrmErrors = {
    contact: step1ErrorsByPath["lead.contact"],
    dept: step1ErrorsByPath["lead.dept"],
    name: step1ErrorsByPath["lead.name"],
    netId: step1ErrorsByPath["lead.netId"],
    raNumber: step1ErrorsByPath["lead.raNumber"],
  };
  const step1LeadNonSrmErrors = {
    collegeEmail: step1ErrorsByPath["lead.collegeEmail"],
    collegeId: step1ErrorsByPath["lead.collegeId"],
    contact: step1ErrorsByPath["lead.contact"],
    name: step1ErrorsByPath["lead.name"],
  };
  const step1MembersError = step1ErrorsByPath.members;

  const focusStep1Path = useCallback(
    (path: string | null) => {
      if (typeof document === "undefined") {
        return;
      }

      const targetId = getStep1TargetIdByPath(path, teamType);
      const targetElement = document.getElementById(targetId);
      const fallbackElement = document.getElementById(STEP1_ERROR_SUMMARY_ID);
      const focusTarget = (targetElement ??
        fallbackElement) as HTMLElement | null;

      if (!focusTarget) {
        return;
      }

      if (typeof focusTarget.scrollIntoView === "function") {
        focusTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      if (typeof focusTarget.focus === "function") {
        focusTarget.focus();
      }
    },
    [teamType],
  );

  const loadProblemStatements = useCallback(async () => {
    setIsLoadingStatements(true);
    setStatementsLoadError(null);
    setIsStatementsAuthError(false);

    try {
      const response = await fetch("/api/problem-statements", {
        method: "GET",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            statements?: ProblemStatementAvailability[];
          }
        | null;

      if (!response.ok) {
        const errorMessage =
          payload?.error ??
          "We couldn't fetch problem statement availability right now.";
        setStatementsLoadError(errorMessage);
        setIsStatementsAuthError(response.status === 401);
        setProblemStatements([]);
        toast({
          title: "Unable to Load Problem Statements",
          description: errorMessage,
          variant: "destructive",
        });
        return;
      }

      if (!Array.isArray(payload?.statements)) {
        setProblemStatements([]);
        setStatementsLoadError(
          "Problem statements are unavailable right now. Please try again.",
        );
        toast({
          title: "Unable to Load Problem Statements",
          description:
            "Received an invalid response while loading problem statements.",
          variant: "destructive",
        });
        return;
      }

      setProblemStatements(payload.statements);
      setStatementsLoadError(null);
    } catch {
      setProblemStatements([]);
      setStatementsLoadError(
        "Network issue while loading problem statements. Please try again.",
      );
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

  const signInAgainForStatements = useCallback(() => {
    window.location.assign(signInToRegisterHref);
  }, [signInToRegisterHref]);

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
    if (!hasAttemptedStep1Submit) {
      return;
    }

    if (teamPayloadValidation.success) {
      setStep1ErrorsByPath({});
      setStep1SummaryErrors([]);
      setFormValidationError(null);
      return;
    }

    const feedback = buildStep1ValidationFeedback(
      teamPayloadValidation.error.issues,
    );
    setStep1ErrorsByPath(feedback.errorsByPath);
    setStep1SummaryErrors(feedback.summaryErrors);
    setFormValidationError(feedback.firstIssueMessage);
  }, [hasAttemptedStep1Submit, teamPayloadValidation]);

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

      toast({
        title: "Team Was Not Created",
        description: "You exited onboarding before creating your team.",
        variant: "destructive",
      });
    };
  }, []);

  const updateSrmLead = (field: keyof SrmMember, value: string | number) => {
    const normalizedValue =
      typeof value === "string"
        ? field === "netId"
          ? value.toLowerCase()
          : field === "raNumber"
            ? value.toUpperCase()
            : field === "dept"
              ? value.toUpperCase()
              : value
        : value;
    setLeadSrm((prev) => ({ ...prev, [field]: normalizedValue }) as SrmMember);
  };

  const updateSrmDraft = (field: keyof SrmMember, value: string | number) => {
    const normalizedValue =
      typeof value === "string"
        ? field === "netId"
          ? value.toLowerCase()
          : field === "raNumber"
            ? value.toUpperCase()
            : field === "dept"
              ? value.toUpperCase()
              : value
        : value;
    setMemberDraftSrm(
      (prev) => ({ ...prev, [field]: normalizedValue }) as SrmMember,
    );
  };

  const updateNonSrmLead = (
    field: keyof NonSrmMember,
    value: string | number,
  ) => {
    const normalizedValue =
      typeof value === "string" && field === "collegeEmail"
        ? value.toLowerCase()
        : value;
    setLeadNonSrm(
      (prev) => ({ ...prev, [field]: normalizedValue }) as NonSrmMember,
    );
  };

  const updateNonSrmDraft = (
    field: keyof NonSrmMember,
    value: string | number,
  ) => {
    const normalizedValue =
      typeof value === "string" && field === "collegeEmail"
        ? value.toLowerCase()
        : value;
    setMemberDraftNonSrm(
      (prev) => ({ ...prev, [field]: normalizedValue }) as NonSrmMember,
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
    setHasAttemptedStep1Submit(false);
    setStep1ErrorsByPath({});
    setStep1SummaryErrors([]);
    setFormValidationError(null);
    setStep(1);
    setTeamName("");
    setLockedProblemStatement(null);
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

  const validateTeamPayload = ({
    captureStep1ValidationState = false,
    showToast = true,
  }: {
    captureStep1ValidationState?: boolean;
    showToast?: boolean;
  } = {}) => {
    if (!teamPayloadValidation.success) {
      const feedback = buildStep1ValidationFeedback(
        teamPayloadValidation.error.issues,
      );
      setFormValidationError(feedback.firstIssueMessage);
      if (captureStep1ValidationState) {
        setStep1ErrorsByPath(feedback.errorsByPath);
        setStep1SummaryErrors(feedback.summaryErrors);
      }
      if (showToast) {
        toast({
          title: "Team Details Invalid",
          description: feedback.firstIssueMessage,
          variant: "destructive",
        });
      }
      return {
        feedback,
        team: null,
      };
    }

    if (captureStep1ValidationState) {
      setStep1ErrorsByPath({});
      setStep1SummaryErrors([]);
    }
    setFormValidationError(null);
    return {
      feedback: null,
      team: teamPayloadValidation.data,
    };
  };

  const goToProblemStatementsStep = () => {
    setHasAttemptedStep1Submit(true);
    const validationResult = validateTeamPayload({
      captureStep1ValidationState: true,
      showToast: false,
    });
    if (!validationResult.team) {
      focusStep1Path(validationResult.feedback?.firstInvalidPath ?? null);
      return;
    }

    setHasAttemptedStep1Submit(false);
    setFormValidationError(null);
    setStep(2);
  };

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
      toast({
        title: "Problem Statement Locked",
        description: "Problem statement locked successfully.",
        variant: "success",
      });
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

  const requestProblemStatementLock = (
    problemStatementId: string,
    problemStatementTitle: string,
  ) => {
    if (
      lockedProblemStatement ||
      isCreatingTeam ||
      isRedirecting ||
      Boolean(isLockingProblemStatementId)
    ) {
      return;
    }

    setPendingLockProblemStatement({
      id: problemStatementId,
      title: problemStatementTitle,
    });
    setLockConfirmationStep("confirm");
    setLockConfirmationInput("");
  };

  const confirmProblemStatementLock = () => {
    if (!pendingLockProblemStatement || !canConfirmProblemStatementLock) {
      return;
    }

    const problemStatementId = pendingLockProblemStatement.id;
    setPendingLockProblemStatement(null);
    setLockConfirmationStep("confirm");
    setLockConfirmationInput("");
    void lockProblemStatement(problemStatementId);
  };

  const closeProblemStatementLockConfirm = () => {
    setPendingLockProblemStatement(null);
    setLockConfirmationStep("confirm");
    setLockConfirmationInput("");
  };

  const proceedToProblemStatementLockTypeStep = () => {
    if (!pendingLockProblemStatement) {
      return;
    }
    setLockConfirmationStep("type");
  };

  const backToProblemStatementLockConfirmStep = () => {
    setLockConfirmationStep("confirm");
  };

  const createTeam = async () => {
    const validationResult = validateTeamPayload();
    if (!validationResult.team) {
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
          team: validationResult.team,
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
      router.push(`/dashboard/${data.team.id}?created=1`);
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
      <div className="absolute inset-0 bg-linear-to-br from-white/16 via-transparent to-fnblue/10 pointer-events-none opacity-65 motion-safe:animate-[ambient-pan_14s_ease-in-out_infinite]" />
      <div className="absolute -top-20 -left-10 size-80 rounded-full bg-fnblue/16 blur-3xl pointer-events-none motion-safe:animate-[ambient-orbit_17s_ease-in-out_infinite]" />
      <div className="absolute -bottom-24 right-0 size-96 rounded-full bg-fnyellow/20 blur-3xl pointer-events-none motion-safe:animate-[ambient-orbit_20s_ease-in-out_infinite]" />
      <div className="fncontainer relative py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <InView
            once
            viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
            transition={{ ...MOTION_TRANSITIONS.slow, delay: 0.02 }}
            variants={SCROLL_FLOW_VARIANTS}
          >
            <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-emphasized)] hover:-translate-y-0.5 hover:border-fnblue/80 hover:shadow-[0_20px_36px_rgba(39,114,160,0.2)] md:p-8">
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                  onboarding wizard
                </h1>
                <p className="text-foreground/80 font-medium">
                  Enter team details, lock one problem statement, and create
                  your team.
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  {[
                    {
                      label: "1. Team Details",
                      tone:
                        step === 1
                          ? "border-fnblue bg-fnblue text-white"
                          : "border-fnblue bg-fnblue/20",
                    },
                    {
                      label: "2. Lock Statement",
                      tone:
                        step === 2
                          ? "border-fngreen bg-fngreen text-white"
                          : "border-fngreen bg-fngreen/20",
                    },
                    {
                      label: "3. Create Team",
                      tone: lockedProblemStatement
                        ? "border-fnyellow bg-fnyellow/30"
                        : "border-fnyellow bg-fnyellow/20",
                    },
                  ].map((progressStep) => (
                    <p
                      key={progressStep.label}
                      className={`rounded-md border px-2 py-2 text-xs uppercase tracking-wide font-bold ${progressStep.tone}`}
                    >
                      {progressStep.label}
                    </p>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {step === 1 ? (
                  <motion.div
                    key="register-step-1"
                    initial={
                      isReducedMotion ? false : STEP_PANEL_VARIANTS.hidden
                    }
                    animate={STEP_PANEL_VARIANTS.visible}
                    exit={
                      isReducedMotion ? undefined : STEP_PANEL_VARIANTS.exit
                    }
                    transition={PANEL_TRANSITION}
                  >
                    <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 shadow-sm">
                      <p className="text-sm md:text-base font-bold uppercase tracking-widest mb-3 text-fnblue">
                        Team Type
                      </p>
                      <label className="block">
                        <p className="text-xs text-foreground/80 font-medium mb-2">
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
                      <p className="text-sm md:text-base font-bold uppercase tracking-widest mb-3 text-fnblue">
                        Team Identity
                      </p>
                      <Input
                        label="Team Name"
                        id={STEP1_INPUT_IDS.teamName}
                        value={teamName}
                        onChange={setTeamName}
                        error={
                          hasAttemptedStep1Submit
                            ? step1ErrorsByPath.teamName
                            : undefined
                        }
                      />
                    </div>

                    {teamType === "non_srm" && (
                      <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
                        <p className="text-sm md:text-base font-bold uppercase tracking-widest mb-3 text-fnblue">
                          Non-SRM Team Info
                        </p>
                        <div className="grid gap-3 md:grid-cols-2">
                          <Input
                            label="College Name"
                            id={STEP1_INPUT_IDS.collegeName}
                            value={nonSrmMeta.collegeName}
                            onChange={(value) =>
                              setNonSrmMeta((prev) => ({
                                ...prev,
                                collegeName: value,
                              }))
                            }
                            error={
                              hasAttemptedStep1Submit
                                ? step1ErrorsByPath.collegeName
                                : undefined
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
                                clubName: event.target.checked
                                  ? prev.clubName
                                  : "",
                              }))
                            }
                          />
                          Team represents a club
                        </label>
                        <div className="mt-3">
                          <Input
                            label="Club Name (or empty)"
                            id={STEP1_INPUT_IDS.clubName}
                            value={nonSrmMeta.clubName}
                            onChange={(value) =>
                              setNonSrmMeta((prev) => ({
                                ...prev,
                                clubName: value,
                              }))
                            }
                            error={
                              hasAttemptedStep1Submit
                                ? step1ErrorsByPath.clubName
                                : undefined
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
                          errors={
                            hasAttemptedStep1Submit
                              ? step1LeadSrmErrors
                              : undefined
                          }
                          inputIds={{
                            contact: STEP1_INPUT_IDS.leadSrmContact,
                            dept: STEP1_INPUT_IDS.leadSrmDept,
                            name: STEP1_INPUT_IDS.leadSrmName,
                            netId: STEP1_INPUT_IDS.leadSrmNetId,
                            raNumber: STEP1_INPUT_IDS.leadSrmRaNumber,
                          }}
                        />
                        <MemberDraftCard
                          addButtonId={STEP1_ADD_MEMBER_BUTTON_ID}
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
                          errors={
                            hasAttemptedStep1Submit
                              ? step1LeadNonSrmErrors
                              : undefined
                          }
                          inputIds={{
                            collegeEmail:
                              STEP1_INPUT_IDS.leadNonSrmCollegeEmail,
                            collegeId: STEP1_INPUT_IDS.leadNonSrmCollegeId,
                            contact: STEP1_INPUT_IDS.leadNonSrmContact,
                            name: STEP1_INPUT_IDS.leadNonSrmName,
                          }}
                        />
                        <MemberDraftCard
                          addButtonId={STEP1_ADD_MEMBER_BUTTON_ID}
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
                    <AnimatePresence initial={false}>
                      {hasAttemptedStep1Submit && step1MembersError ? (
                        <motion.p
                          initial={
                            isReducedMotion ? false : { opacity: 0, y: 8 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            isReducedMotion ? undefined : { opacity: 0, y: -6 }
                          }
                          transition={PANEL_TRANSITION}
                          className="mt-2 rounded-md border border-fnred/35 bg-fnred/10 px-3 py-2 text-sm font-semibold text-fnred"
                        >
                          {step1MembersError}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>
                    <AnimatePresence initial={false}>
                      {hasAttemptedStep1Submit &&
                      step1SummaryErrors.length > 0 ? (
                        <motion.div
                          id={STEP1_ERROR_SUMMARY_ID}
                          className="mt-3 rounded-lg border border-fnorange/35 bg-fnorange/10 px-4 py-3"
                          tabIndex={-1}
                          initial={
                            isReducedMotion ? false : { opacity: 0, y: 8 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            isReducedMotion ? undefined : { opacity: 0, y: -6 }
                          }
                          transition={PANEL_TRANSITION}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fnorange">
                            Fix These To Continue
                          </p>
                          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/85">
                            {step1SummaryErrors.map((error) => (
                              <li key={error}>{error}</li>
                            ))}
                          </ul>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                    <AnimatePresence initial={false}>
                      {formValidationError && !hasAttemptedStep1Submit ? (
                        <motion.p
                          initial={
                            isReducedMotion ? false : { opacity: 0, y: 8 }
                          }
                          animate={{ opacity: 1, y: 0 }}
                          exit={
                            isReducedMotion ? undefined : { opacity: 0, y: -6 }
                          }
                          transition={PANEL_TRANSITION}
                          className="mt-2 rounded-md border border-fnred/35 bg-fnred/10 px-3 py-2 text-sm font-semibold text-fnred"
                        >
                          {formValidationError}
                        </motion.p>
                      ) : null}
                    </AnimatePresence>

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
                        disabled={isCreatingTeam || isRedirecting}
                      >
                        Next
                      </FnButton>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="register-step-2"
                    initial={
                      isReducedMotion ? false : STEP_PANEL_VARIANTS.hidden
                    }
                    animate={STEP_PANEL_VARIANTS.visible}
                    exit={
                      isReducedMotion ? undefined : STEP_PANEL_VARIANTS.exit
                    }
                    transition={PANEL_TRANSITION}
                  >
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
                        Lock one statement to continue. This can only be done
                        once, and the statement cannot be changed after lock.
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
                            className="h-40 animate-pulse rounded-xl border border-foreground/20 bg-foreground/10"
                          />
                        ))}

                      {!isLoadingStatements &&
                        problemStatements.map((statement, index) => {
                          const isLockedCard =
                            lockedProblemStatement?.id === statement.id;
                          const lockDisabled =
                            Boolean(lockedProblemStatement) ||
                            statement.isFull ||
                            Boolean(isLockingProblemStatementId) ||
                            isCreatingTeam ||
                            isRedirecting;

                          return (
                            <motion.div
                              key={statement.id}
                              initial={
                                isReducedMotion ? false : { opacity: 0, y: 8 }
                              }
                              animate={{ opacity: 1, y: 0 }}
                              transition={{
                                ...PANEL_TRANSITION,
                                delay: isReducedMotion ? 0 : index * 0.04,
                              }}
                              layout={!isReducedMotion}
                              className="group relative overflow-hidden rounded-xl border border-foreground/15 bg-linear-to-br from-card via-card to-fnblue/8 p-4 text-foreground shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                            >
                              <div className="absolute -right-8 -top-8 size-24 rounded-full bg-fnyellow/15 blur-2xl pointer-events-none" />
                              <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-fnblue/75">
                                Track {index + 1}
                              </p>
                              <h3 className="relative mt-1 text-[15px] font-black uppercase tracking-[0.04em] leading-snug text-foreground">
                                {statement.title}
                              </h3>
                              <p className="relative mt-2 text-sm text-foreground/75 leading-relaxed">
                                {statement.summary}
                              </p>

                              <div className="relative mt-4">
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
                                      requestProblemStatementLock(
                                        statement.id,
                                        statement.title,
                                      )
                                    }
                                    disabled={lockDisabled}
                                    loading={
                                      isLockingProblemStatementId ===
                                      statement.id
                                    }
                                    loadingText="Locking..."
                                  >
                                    Lock Problem Statement
                                  </FnButton>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                    </div>

                    {!isLoadingStatements && statementsLoadError && (
                      <div className="mt-6 rounded-xl border border-b-4 border-fnred/55 bg-fnred/7 p-4 shadow-sm">
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-fnred">
                          Unable to load statements
                        </p>
                        <p className="mt-2 text-sm text-foreground/80">
                          {statementsLoadError}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <FnButton
                            type="button"
                            tone="gray"
                            size="sm"
                            onClick={() => {
                              void loadProblemStatements();
                            }}
                          >
                            Retry
                          </FnButton>
                          {isStatementsAuthError ? (
                            <FnButton
                              type="button"
                              tone="red"
                              size="sm"
                              onClick={signInAgainForStatements}
                            >
                              Sign In Again
                            </FnButton>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {!isLoadingStatements &&
                      !statementsLoadError &&
                      problemStatements.length === 0 && (
                      <p className="mt-6 text-sm text-foreground/70">
                        Problem statements are unavailable right now. Please
                        retry.
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
                        disabled={
                          !canCreateTeam || isCreatingTeam || isRedirecting
                        }
                        loading={isCreatingTeam || isRedirecting}
                        loadingText={
                          isRedirecting ? "Redirecting..." : "Creating Team..."
                        }
                      >
                        Create Team
                      </FnButton>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </InView>

          <aside className="space-y-4 lg:sticky lg:top-10 self-start pr-1">
            <InView
              once
              viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
              transition={{ ...MOTION_TRANSITIONS.slow, delay: 0.08 }}
              variants={SCROLL_FLOW_VARIANTS}
            >
              <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-md backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-emphasized)] hover:-translate-y-0.5 hover:border-fnyellow/80 hover:shadow-[0_16px_30px_rgba(245,208,0,0.2)]">
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
            </InView>

            <InView
              once
              viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
              transition={{ ...MOTION_TRANSITIONS.slow, delay: 0.12 }}
              variants={SCROLL_FLOW_VARIANTS}
            >
              <div className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-md backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-emphasized)] hover:-translate-y-0.5 hover:border-fnblue/80 hover:shadow-[0_16px_30px_rgba(39,114,160,0.2)]">
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
                        <td className="py-2 pr-3 font-bold text-fnblue">
                          Lead
                        </td>
                        <td className="py-2 pr-3">{currentLead.name || "-"}</td>
                        <td className="py-2 pr-3">{currentLeadId || "-"}</td>
                        <td className="py-2">{currentLead.contact || "-"}</td>
                        <td className="py-2 pl-2 text-right text-foreground/40">
                          -
                        </td>
                      </tr>
                      <AnimatePresence initial={false}>
                        {currentMembers.map((member, index) => (
                          <motion.tr
                            key={`${getCurrentMemberId(member)}-${index}`}
                            layout={!isReducedMotion}
                            initial={
                              isReducedMotion
                                ? false
                                : { opacity: 0, y: 10, filter: "blur(2px)" }
                            }
                            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                            exit={
                              isReducedMotion
                                ? undefined
                                : { opacity: 0, y: -8, filter: "blur(2px)" }
                            }
                            transition={PANEL_TRANSITION}
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
                          </motion.tr>
                        ))}
                      </AnimatePresence>
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
            </InView>
          </aside>
        </div>
      </div>

      {pendingLockProblemStatement ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lock-problem-statement-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-b-4 border-fnred bg-background p-6 shadow-2xl">
              <p
                id="lock-problem-statement-title"
                className="text-sm font-bold uppercase tracking-[0.18em] text-fnred"
              >
                Confirm Problem Statement Lock
              </p>
              <p className="mt-3 text-sm text-foreground/80">
                This action cannot be reverted. Are you sure you want to lock
                this problem statement?
              </p>
              <p className="mt-3 rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-semibold">
                {pendingLockProblemStatement.title}
              </p>
              {lockConfirmationStep === "confirm" ? (
                <div className="mt-6 flex justify-end gap-2">
                  <FnButton
                    type="button"
                    onClick={closeProblemStatementLockConfirm}
                    tone="gray"
                    size="sm"
                  >
                    Cancel
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={proceedToProblemStatementLockTypeStep}
                    tone="red"
                    size="sm"
                  >
                    Continue
                  </FnButton>
                </div>
              ) : (
                <>
                  <div className="mt-3 rounded-lg border border-fnred/25 bg-fnred/5 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fnred">
                      Final Confirmation
                    </p>
                    <p className="mt-1 text-xs text-foreground/75">
                      Type this exact phrase to continue:
                    </p>
                    <p className="mt-2 rounded-md border border-foreground/15 bg-white px-3 py-2 font-mono text-sm font-semibold text-foreground">
                      "{lockConfirmationPhrase}"
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-foreground/70">
                    Include spaces exactly as shown above.
                  </p>
                  <input
                    type="text"
                    value={lockConfirmationInput}
                    onChange={(event) =>
                      setLockConfirmationInput(event.target.value)
                    }
                    placeholder={`Type "${lockConfirmationPhrase}"`}
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="mt-2 w-full rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
                  />
                  <div className="mt-6 flex justify-end gap-2">
                    <FnButton
                      type="button"
                      onClick={backToProblemStatementLockConfirmStep}
                      tone="gray"
                      size="sm"
                    >
                      Back
                    </FnButton>
                    <FnButton
                      type="button"
                      onClick={confirmProblemStatementLock}
                      tone="red"
                      size="sm"
                      disabled={!canConfirmProblemStatementLock}
                    >
                      Yes, Lock Statement
                    </FnButton>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalPortal>
      ) : null}

      {showClearConfirm ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
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
        </ModalPortal>
      ) : null}

      <datalist id={SRM_DEPARTMENT_DATALIST_ID}>
        {SRM_MAJOR_DEPARTMENTS.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>
    </main>
  );
};

const MemberDraftCard = ({
  addButtonId,
  canAddMember,
  onAdd,
  count,
  children,
}: {
  addButtonId?: string;
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
        id={addButtonId}
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
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  list?: string;
  error?: string;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

const Input = ({
  id,
  label,
  value,
  onChange,
  list,
  error,
  type = "text",
  required = false,
  minLength,
  maxLength,
  pattern,
}: InputProps) => (
  <label className="block">
    <p className="text-xs text-foreground/80 font-medium mb-1">
      {label}
    </p>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      list={list}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && id ? `${id}-error` : undefined}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
      className={`w-full rounded-md border bg-background px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50 ${
        error ? "border-fnred/45" : "border-foreground/20"
      }`}
    />
    {error && id ? (
      <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-fnred">
        {error}
      </p>
    ) : null}
  </label>
);

type SrmEditorProps = {
  title: string;
  member: SrmMember;
  onChange: (field: keyof SrmMember, value: string | number) => void;
  className?: string;
  errors?: Partial<Record<keyof SrmMember, string>>;
  inputIds?: Partial<Record<keyof SrmMember, string>>;
};

const SrmMemberEditor = ({
  title,
  member,
  onChange,
  className = "",
  errors,
  inputIds,
}: SrmEditorProps) => (
  <div
    className={`rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm ${className}`}
  >
    <p className="text-sm md:text-base font-bold uppercase tracking-widest mb-3 text-fnblue">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="Name"
        id={inputIds?.name}
        value={member.name}
        onChange={(v) => onChange("name", v)}
        error={errors?.name}
      />
      <Input
        label="Registration Number"
        id={inputIds?.raNumber}
        value={member.raNumber}
        onChange={(v) => onChange("raNumber", v)}
        error={errors?.raNumber}
      />
      <Input
        label="NetID"
        id={inputIds?.netId}
        value={member.netId}
        onChange={(v) => onChange("netId", v)}
        error={errors?.netId}
      />
      <Input
        label="Department"
        id={inputIds?.dept}
        value={member.dept}
        onChange={(v) => onChange("dept", v)}
        list={SRM_DEPARTMENT_DATALIST_ID}
        error={errors?.dept}
      />
      <div className="md:col-span-2">
        <NumberInput
          label="Contact"
          id={inputIds?.contact}
          value={member.contact}
          onChange={(v) => onChange("contact", v)}
          error={errors?.contact}
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
  errors?: Partial<Record<keyof NonSrmMember, string>>;
  inputIds?: Partial<Record<keyof NonSrmMember, string>>;
};

const NonSrmMemberEditor = ({
  title,
  member,
  onChange,
  className = "",
  errors,
  inputIds,
}: NonSrmEditorProps) => (
  <div
    className={`rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm ${className}`}
  >
    <p className="text-sm md:text-base font-bold uppercase tracking-widest mb-3 text-fnblue">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="Name"
        id={inputIds?.name}
        value={member.name}
        onChange={(v) => onChange("name", v)}
        error={errors?.name}
        required
        minLength={2}
        maxLength={100}
      />
      <Input
        label="College ID Number"
        id={inputIds?.collegeId}
        value={member.collegeId}
        onChange={(v) => onChange("collegeId", v)}
        error={errors?.collegeId}
        required
        minLength={3}
        maxLength={50}
      />
      <Input
        label="College Email / Personal Email"
        id={inputIds?.collegeEmail}
        value={member.collegeEmail}
        onChange={(v) => onChange("collegeEmail", v)}
        error={errors?.collegeEmail}
        type="email"
        required
      />
      <NumberInput
        label="Contact"
        id={inputIds?.contact}
        value={member.contact}
        onChange={(v) => onChange("contact", v)}
        error={errors?.contact}
      />
    </div>
  </div>
);

type NumberInputProps = {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  error?: string;
};

const NumberInput = ({
  id,
  label,
  value,
  onChange,
  error,
}: NumberInputProps) => (
  <label className="block">
    <p className="text-xs text-foreground/80 font-medium mb-1">
      {label}
    </p>
    <input
      id={id}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]{10,15}"
      value={value === 0 ? "" : value}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
      aria-invalid={error ? true : undefined}
      aria-describedby={error && id ? `${id}-error` : undefined}
      required
      minLength={10}
      maxLength={15}
      className={`w-full rounded-md border bg-background px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50 ${
        error ? "border-fnred/45" : "border-foreground/20"
      }`}
    />
    {error && id ? (
      <p id={`${id}-error`} className="mt-1 text-xs font-semibold text-fnred">
        {error}
      </p>
    ) : null}
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
