"use client";

import {
  Copy,
  Download,
  ExternalLink,
  Info,
  PlusIcon,
  Trash2,
  UserRoundPen,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { useRouteProgress } from "@/components/ui/route-progress";
import { toast } from "@/hooks/use-toast";
import {
  isPresentationExtensionAllowed,
  isPresentationMimeTypeAllowed,
  PRESENTATION_MAX_FILE_SIZE_BYTES,
  PRESENTATION_TEMPLATE_PATH,
} from "@/lib/presentation";
import {
  type NonSrmMember,
  nonSrmMemberSchema,
  SRM_MAJOR_DEPARTMENTS,
  type SrmMember,
  srmMemberSchema,
  type TeamRecord,
  teamSubmissionSchema,
} from "@/lib/register-schema";
import { DASHBOARD_RULE_GROUPS } from "./dashboard-rules";
import {
  buildDashboardTabUrl,
  DASHBOARD_TABS,
  type DashboardTab,
  parseDashboardTab,
} from "./dashboard-tabs";

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

type PendingLockProblemStatement = {
  id: string;
  title: string;
};

type PresentationInfo = {
  fileName: string;
  fileSizeBytes: number | null;
  mimeType: string;
  publicUrl: string;
  storagePath: string;
  uploadedAt: string;
};

type TeamApprovalStatus = NonNullable<TeamRecord["approvalStatus"]>;
type ConfirmationStep = "confirm" | "type";

const MAX_MEMBERS = 5;
const SRM_EMAIL_DOMAIN = "@srmist.edu.in";
const SRM_DEPARTMENT_DATALIST_ID = "srm-major-departments-dashboard";

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

const emptyPresentation = (): PresentationInfo => ({
  fileName: "",
  fileSizeBytes: null,
  mimeType: "",
  publicUrl: "",
  storagePath: "",
  uploadedAt: "",
});

const toSrmLeadEmail = (netId: string) => {
  const normalized = netId.trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized.endsWith(SRM_EMAIL_DOMAIN)
    ? normalized
    : `${normalized}${SRM_EMAIL_DOMAIN}`;
};

const formatDateTime = (value: string) => {
  if (!value) return "N/A";
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime())
    ? value
    : parsedDate.toLocaleString();
};

const formatBytes = (value: number | null) => {
  if (!value || value <= 0) {
    return "N/A";
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const toTicketLine = (value: string, maxLength: number) => {
  const normalized = value.trim();
  if (!normalized) {
    return "N/A";
  }

  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1)}…`
    : normalized;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
};

const loadCanvasImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Window is unavailable."));
      return;
    }

    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image."));
    image.src = src;
  });

const buildAcceptedTeamTicketDataUrl = async ({
  qrDataUrl,
  statementTitle,
  teamId,
  teamName,
}: {
  qrDataUrl: string;
  statementTitle: string;
  teamId: string;
  teamName: string;
}) => {
  if (typeof document === "undefined") {
    throw new Error("Document is unavailable.");
  }

  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 675;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context is unavailable.");
  }

  const backdropGradient = ctx.createLinearGradient(0, 0, width, height);
  backdropGradient.addColorStop(0, "#0f172a");
  backdropGradient.addColorStop(0.56, "#1d4ed8");
  backdropGradient.addColorStop(1, "#f97316");
  ctx.fillStyle = backdropGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.14;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 12; i += 1) {
    const size = 18 + ((i % 4) + 1) * 6;
    const x = 70 + i * 92;
    const y = 48 + (i % 3) * 28;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const cardX = 58;
  const cardY = 52;
  const cardWidth = width - 116;
  const cardHeight = height - 104;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 34);
  const cardGradient = ctx.createLinearGradient(
    cardX,
    cardY,
    cardX + cardWidth,
    cardY + cardHeight,
  );
  cardGradient.addColorStop(0, "#fff7ed");
  cardGradient.addColorStop(0.48, "#ffffff");
  cardGradient.addColorStop(1, "#eff6ff");
  ctx.fillStyle = cardGradient;
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(15, 23, 42, 0.2)";
  ctx.stroke();

  const splitX = Math.round(cardX + cardWidth * 0.67);
  ctx.save();
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(30, 64, 175, 0.35)";
  ctx.beginPath();
  ctx.moveTo(splitX, cardY + 34);
  ctx.lineTo(splitX, cardY + cardHeight - 34);
  ctx.stroke();
  ctx.restore();

  const punchRadius = 24;
  ctx.fillStyle = "#1d4ed8";
  ctx.beginPath();
  ctx.arc(splitX, cardY, punchRadius, 0, Math.PI, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(splitX, cardY + cardHeight, punchRadius, Math.PI, 0, true);
  ctx.fill();

  const leftX = cardX + 52;
  const leftMaxWidth = splitX - leftX - 48;
  const teamNameLine = toTicketLine(teamName, 34);
  const statementLine = toTicketLine(statementTitle, 54);

  ctx.fillStyle = "#1d4ed8";
  ctx.font = "800 22px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FOUNDATHON 3.0", leftX, cardY + 56);

  ctx.fillStyle = "#0f172a";
  ctx.font = "800 50px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("TEAM ACCESS PASS", leftX, cardY + 124);

  const statusPillX = leftX;
  const statusPillY = cardY + 150;
  const statusPillWidth = 276;
  const statusPillHeight = 46;
  const statusText = "STATUS: ACCEPTED";

  drawRoundedRect(
    ctx,
    statusPillX,
    statusPillY,
    statusPillWidth,
    statusPillHeight,
    16,
  );
  ctx.fillStyle = "#dcfce7";
  ctx.fill();
  ctx.fillStyle = "#166534";
  let statusFontSize = 21;
  while (statusFontSize > 14) {
    ctx.font = `700 ${statusFontSize}px 'Helvetica Neue', Arial, sans-serif`;
    if (ctx.measureText(statusText).width <= statusPillWidth - 24) {
      break;
    }
    statusFontSize -= 1;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    statusText,
    statusPillX + statusPillWidth / 2,
    statusPillY + statusPillHeight / 2,
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.font = "700 18px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("TEAM NAME", leftX, cardY + 238);
  ctx.fillStyle = "#111827";
  ctx.font = "800 40px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(teamNameLine, leftX, cardY + 286, leftMaxWidth);

  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.font = "700 18px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("TEAM ID", leftX, cardY + 340);
  ctx.fillStyle = "#0f172a";
  ctx.font = "700 26px 'SFMono-Regular', Menlo, Consolas, monospace";
  ctx.fillText(teamId, leftX, cardY + 378, leftMaxWidth);

  ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
  ctx.font = "700 18px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("LOCKED TRACK", leftX, cardY + 430);
  ctx.fillStyle = "#1f2937";
  ctx.font = "700 26px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(statementLine, leftX, cardY + 468, leftMaxWidth);

  ctx.fillStyle = "rgba(15, 23, 42, 0.7)";
  ctx.font = "600 16px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    `Issued: ${new Date().toLocaleString()}`,
    leftX,
    cardY + cardHeight - 34,
  );

  const qrPanelX = splitX + 40;
  const qrPanelY = cardY + 86;
  const qrPanelWidth = cardX + cardWidth - qrPanelX - 34;
  const qrPanelHeight = cardHeight - 172;
  drawRoundedRect(ctx, qrPanelX, qrPanelY, qrPanelWidth, qrPanelHeight, 22);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(59, 130, 246, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "#1e3a8a";
  ctx.font = "800 20px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("SCAN TEAM QR", qrPanelX + 26, qrPanelY + 42);

  const qrImage = await loadCanvasImage(qrDataUrl);
  const qrSize = 230;
  const qrX = qrPanelX + (qrPanelWidth - qrSize) / 2;
  const qrY = qrPanelY + 66;
  drawRoundedRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16);
  ctx.fillStyle = "#f8fafc";
  ctx.fill();
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = "rgba(15, 23, 42, 0.68)";
  ctx.font = "700 14px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    "Carry this pass during check-in.",
    qrPanelX + 26,
    qrY + qrSize + 54,
  );

  return canvas.toDataURL("image/png");
};

const snapshotMembers = (members: SrmMember[] | NonSrmMember[]) =>
  JSON.stringify(members);

const normalizeConfirmationText = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const toPresentationPreviewUrl = (publicUrl: string) => {
  const normalizedUrl = publicUrl.trim();
  if (!normalizedUrl) {
    return "";
  }

  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    normalizedUrl,
  )}`;
};

const normalizeApprovalStatus = (
  value: string | undefined,
): TeamApprovalStatus | undefined => {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "accepted":
    case "invalid":
    case "rejected":
    case "submitted":
      return normalized;
    default:
      return undefined;
  }
};

const resolveTeamApprovalStatus = ({
  dbStatus,
  isPresentationSubmitted,
}: {
  dbStatus: TeamApprovalStatus | undefined;
  isPresentationSubmitted: boolean;
}): TeamApprovalStatus => {
  if (dbStatus === "accepted" || dbStatus === "rejected") {
    return dbStatus;
  }

  return isPresentationSubmitted ? "submitted" : "invalid";
};

const getTeamApprovalStatusMeta = (status: TeamApprovalStatus) => {
  switch (status) {
    case "accepted":
      return {
        badgeClass: "border-fngreen/40 bg-fngreen/10 text-fngreen",
        description:
          "Your team has been approved by admins. You are cleared to participate in the event flow.",
        dotClass: "bg-fngreen",
        label: "Accepted",
        panelClass:
          "border-fngreen bg-linear-to-r from-fngreen/15 via-background to-fngreen/5",
      };
    case "rejected":
      return {
        badgeClass: "border-fnred/40 bg-fnred/10 text-fnred",
        description:
          "Your submission was reviewed and rejected by admins. Wait for organizer guidance on next steps.",
        dotClass: "bg-fnred",
        label: "Rejected",
        panelClass:
          "border-fnred bg-linear-to-r from-fnred/15 via-background to-fnred/5",
      };
    case "submitted":
      return {
        badgeClass: "border-fnblue/40 bg-fnblue/10 text-fnblue",
        description:
          "Your PPT is submitted and currently under admin review. Final status will move to Accepted or Rejected.",
        dotClass: "bg-fnblue",
        label: "Submitted",
        panelClass:
          "border-fnblue bg-linear-to-r from-fnblue/15 via-background to-fnblue/5",
      };
    default:
      return {
        badgeClass: "border-slate-500/40 bg-slate-500/10 text-slate-700",
        description:
          "Team is created but no PPT is submitted yet. Submit your presentation from Actions to move to review.",
        dotClass: "bg-slate-500",
        label: "Invalid",
        panelClass:
          "border-slate-400 bg-linear-to-r from-slate-100/80 via-background to-slate-50",
      };
  }
};

export default function TeamDashboardPage() {
  const params = useParams<{ teamId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { start: startRouteProgress } = useRouteProgress();
  const teamId = params.teamId;
  const createdToastShownRef = useRef(false);
  const presentationFileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [deleteConfirmationStep, setDeleteConfirmationStep] =
    useState<ConfirmationStep>("confirm");
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [pendingLockProblemStatement, setPendingLockProblemStatement] =
    useState<PendingLockProblemStatement | null>(null);
  const [legacyLockConfirmationStep, setLegacyLockConfirmationStep] =
    useState<ConfirmationStep>("confirm");
  const [legacyLockConfirmationInput, setLegacyLockConfirmationInput] =
    useState("");
  const [teamApprovalStatusFromDb, setTeamApprovalStatusFromDb] = useState<
    TeamApprovalStatus | undefined
  >(undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState("");
  const [problemStatement, setProblemStatement] =
    useState<ProblemStatementInfo>(emptyProblemStatement());
  const [presentation, setPresentation] = useState<PresentationInfo>(
    emptyPresentation(),
  );
  const [pendingPresentationFile, setPendingPresentationFile] =
    useState<File | null>(null);
  const [showPresentationConfirm, setShowPresentationConfirm] = useState(false);
  const [showPresentationPreview, setShowPresentationPreview] = useState(false);
  const [isSubmittingPresentation, setIsSubmittingPresentation] =
    useState(false);
  const [lastSavedMembersSnapshot, setLastSavedMembersSnapshot] = useState("");
  const [problemStatements, setProblemStatements] = useState<
    ProblemStatementAvailability[]
  >([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [teamIdQrDataUrl, setTeamIdQrDataUrl] = useState("");
  const [isGeneratingTeamQr, setIsGeneratingTeamQr] = useState(false);
  const [teamQrGenerationError, setTeamQrGenerationError] = useState(false);
  const [showTeamTicketModal, setShowTeamTicketModal] = useState(false);
  const [teamTicketPreviewDataUrl, setTeamTicketPreviewDataUrl] = useState("");
  const [isGeneratingTeamTicketPreview, setIsGeneratingTeamTicketPreview] =
    useState(false);
  const [teamTicketPreviewError, setTeamTicketPreviewError] = useState(false);
  const [isDownloadingTeamTicket, setIsDownloadingTeamTicket] = useState(false);
  const [isSharingTeamTicket, setIsSharingTeamTicket] = useState(false);

  const currentMembers = teamType === "srm" ? membersSrm : membersNonSrm;
  const currentMembersSnapshot = useMemo(
    () => snapshotMembers(currentMembers),
    [currentMembers],
  );
  const hasUnsavedMemberChanges =
    !isLoading && currentMembersSnapshot !== lastSavedMembersSnapshot;
  const currentLeadId =
    teamType === "srm" ? leadSrm.netId : leadNonSrm.collegeId;
  const memberCount = 1 + currentMembers.length;
  const rawTab = searchParams.get("tab");
  const createdQuery = searchParams.get("created");
  const activeTab = parseDashboardTab(rawTab);
  const isPresentationSubmitted = Boolean(presentation.publicUrl);
  const resolvedTeamApprovalStatus = resolveTeamApprovalStatus({
    dbStatus: teamApprovalStatusFromDb,
    isPresentationSubmitted,
  });
  const shouldShowAcceptedQr = resolvedTeamApprovalStatus === "accepted";
  const presentationPreviewUrl = useMemo(
    () => toPresentationPreviewUrl(presentation.publicUrl),
    [presentation.publicUrl],
  );
  const presentationLeadEmail = useMemo(() => {
    if (teamType === "srm") {
      return toSrmLeadEmail(leadSrm.netId);
    }

    return leadNonSrm.collegeEmail.trim().toLowerCase();
  }, [leadNonSrm.collegeEmail, leadSrm.netId, teamType]);
  const canAddMember = memberCount < MAX_MEMBERS;
  const deleteConfirmationPhrase = `delete ${teamName.trim() || "team"}`;
  const legacyLockConfirmationPhrase = pendingLockProblemStatement
    ? `lock ${pendingLockProblemStatement.title}`
    : "";
  const canConfirmDelete =
    normalizeConfirmationText(deleteConfirmationInput) ===
    normalizeConfirmationText(deleteConfirmationPhrase);
  const canConfirmLegacyLock =
    Boolean(pendingLockProblemStatement) &&
    normalizeConfirmationText(legacyLockConfirmationInput) ===
      normalizeConfirmationText(legacyLockConfirmationPhrase);
  const getCurrentMemberId = (member: SrmMember | NonSrmMember) =>
    teamType === "srm"
      ? (member as SrmMember).netId
      : (member as NonSrmMember).collegeId;

  const setPresentationFromTeam = useCallback((team: TeamRecord) => {
    setPresentation({
      fileName: team.presentationFileName ?? "",
      fileSizeBytes: team.presentationFileSizeBytes ?? null,
      mimeType: team.presentationMimeType ?? "",
      publicUrl: team.presentationPublicUrl ?? "",
      storagePath: team.presentationStoragePath ?? "",
      uploadedAt: team.presentationUploadedAt ?? "",
    });
  }, []);

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
    const shouldShowCreatedToast = createdQuery === "1";

    if (shouldShowCreatedToast && !createdToastShownRef.current) {
      createdToastShownRef.current = true;
      toast({
        title: "Team Created Successfully",
        description: "Your team has been created successfully.",
        variant: "success",
      });
    }

    if (shouldShowCreatedToast || rawTab !== activeTab) {
      router.replace(
        buildDashboardTabUrl({
          tab: activeTab,
          teamId,
        }),
      );
    }
  }, [activeTab, createdQuery, rawTab, router, teamId]);

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
        setTeamApprovalStatusFromDb(
          normalizeApprovalStatus(team.approvalStatus),
        );
        setProblemStatement({
          cap: team.problemStatementCap ?? null,
          id: team.problemStatementId ?? "",
          lockedAt: team.problemStatementLockedAt ?? "",
          title: team.problemStatementTitle ?? "",
        });
        setPresentationFromTeam(team);

        if (team.teamType === "srm") {
          setLeadSrm(team.lead);
          setMembersSrm(team.members);
          setLastSavedMembersSnapshot(snapshotMembers(team.members));
          setDraftSrm(emptySrmMember());
        } else {
          setLeadNonSrm(team.lead);
          setMembersNonSrm(team.members);
          setLastSavedMembersSnapshot(snapshotMembers(team.members));
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
  }, [router, setPresentationFromTeam, startRouteProgress, teamId]);

  useEffect(() => {
    if (isLoading || problemStatement.id) {
      return;
    }

    void loadProblemStatements();
  }, [isLoading, loadProblemStatements, problemStatement.id]);

  useEffect(() => {
    if (!isPresentationSubmitted && showPresentationPreview) {
      setShowPresentationPreview(false);
    }
  }, [isPresentationSubmitted, showPresentationPreview]);

  useEffect(() => {
    if (!showPresentationPreview) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPresentationPreview(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showPresentationPreview]);

  useEffect(() => {
    if (!showTeamTicketModal) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowTeamTicketModal(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showTeamTicketModal]);

  useEffect(() => {
    let cancelled = false;

    if (!shouldShowAcceptedQr || !teamId) {
      setTeamIdQrDataUrl("");
      setIsGeneratingTeamQr(false);
      setTeamQrGenerationError(false);
      setShowTeamTicketModal(false);
      setTeamTicketPreviewDataUrl("");
      setIsGeneratingTeamTicketPreview(false);
      setTeamTicketPreviewError(false);
      return;
    }

    setIsGeneratingTeamQr(true);
    setTeamQrGenerationError(false);

    void QRCode.toDataURL(teamId, {
      color: {
        dark: "#0F172A",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "H",
      margin: 1,
      width: 176,
    })
      .then((dataUrl: string) => {
        if (cancelled) {
          return;
        }
        setTeamIdQrDataUrl(dataUrl);
        setTeamQrGenerationError(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setTeamIdQrDataUrl("");
        setTeamQrGenerationError(true);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setIsGeneratingTeamQr(false);
      });

    return () => {
      cancelled = true;
    };
  }, [shouldShowAcceptedQr, teamId]);

  useEffect(() => {
    let cancelled = false;

    if (!showTeamTicketModal || !teamIdQrDataUrl) {
      setTeamTicketPreviewDataUrl("");
      setIsGeneratingTeamTicketPreview(false);
      setTeamTicketPreviewError(false);
      return;
    }

    setIsGeneratingTeamTicketPreview(true);
    setTeamTicketPreviewError(false);

    void buildAcceptedTeamTicketDataUrl({
      qrDataUrl: teamIdQrDataUrl,
      statementTitle: problemStatement.title || "No track selected",
      teamId,
      teamName: teamName || "Unnamed Team",
    })
      .then((dataUrl) => {
        if (cancelled) {
          return;
        }

        setTeamTicketPreviewDataUrl(dataUrl);
        setTeamTicketPreviewError(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setTeamTicketPreviewDataUrl("");
        setTeamTicketPreviewError(true);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsGeneratingTeamTicketPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    problemStatement.title,
    showTeamTicketModal,
    teamId,
    teamIdQrDataUrl,
    teamName,
  ]);

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
        description:
          "Member draft updated. Click Save Member Changes to persist.",
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
      description:
        "Member draft updated. Click Save Member Changes to persist.",
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
      description:
        "Member draft updated. Click Save Member Changes to persist.",
      variant: "success",
    });
    cancelEditMember();
  };

  const saveChanges = async () => {
    if (!hasUnsavedMemberChanges) {
      return;
    }

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
      setTeamApprovalStatusFromDb(
        normalizeApprovalStatus(data.team.approvalStatus),
      );
      if (data.team.teamType === "srm") {
        setMembersSrm(data.team.members);
      } else {
        setMembersNonSrm(data.team.members);
      }
      setLastSavedMembersSnapshot(snapshotMembers(data.team.members));
      setFormError(null);
      toast({
        title: "Team Changes Saved",
        description: "Member changes have been saved successfully.",
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
      setTeamApprovalStatusFromDb(
        normalizeApprovalStatus(patchData.team.approvalStatus),
      );
      setProblemStatement({
        cap: patchData.team.problemStatementCap ?? null,
        id: patchData.team.problemStatementId ?? "",
        lockedAt: patchData.team.problemStatementLockedAt ?? "",
        title: patchData.team.problemStatementTitle ?? "",
      });

      toast({
        title: "Problem Statement Locked",
        description: "Problem statement locked successfully.",
        variant: "success",
      });
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

  const requestLegacyProblemStatementLock = (
    problemStatementId: string,
    problemStatementTitle: string,
  ) => {
    if (
      problemStatement.id ||
      isAssigningStatement ||
      isSaving ||
      isDeleting ||
      isLoading
    ) {
      return;
    }

    setPendingLockProblemStatement({
      id: problemStatementId,
      title: problemStatementTitle,
    });
    setLegacyLockConfirmationStep("confirm");
    setLegacyLockConfirmationInput("");
  };

  const confirmLegacyProblemStatementLock = () => {
    if (!pendingLockProblemStatement || !canConfirmLegacyLock) {
      return;
    }

    const problemStatementId = pendingLockProblemStatement.id;
    setPendingLockProblemStatement(null);
    setLegacyLockConfirmationStep("confirm");
    setLegacyLockConfirmationInput("");
    void lockLegacyProblemStatement(problemStatementId);
  };

  const closeLegacyLockConfirm = () => {
    setPendingLockProblemStatement(null);
    setLegacyLockConfirmationStep("confirm");
    setLegacyLockConfirmationInput("");
  };

  const proceedLegacyLockToTypeStep = () => {
    if (!pendingLockProblemStatement) {
      return;
    }
    setLegacyLockConfirmationStep("type");
  };

  const backLegacyLockToConfirmStep = () => {
    setLegacyLockConfirmationStep("confirm");
  };

  const clearPendingPresentationSelection = () => {
    setPendingPresentationFile(null);
    if (presentationFileInputRef.current) {
      presentationFileInputRef.current.value = "";
    }
  };

  const validatePresentationFile = (file: File) => {
    if (file.size <= 0) {
      return "Presentation file is empty.";
    }

    if (file.size > PRESENTATION_MAX_FILE_SIZE_BYTES) {
      return "Presentation file size must be 5 MB or less.";
    }

    if (!isPresentationExtensionAllowed(file.name)) {
      return "Only .ppt or .pptx files are allowed.";
    }

    if (file.type && !isPresentationMimeTypeAllowed(file.type)) {
      return "Invalid presentation file type.";
    }

    return null;
  };

  const handlePresentationFileChange = (files: FileList | null) => {
    if (isPresentationSubmitted || isSubmittingPresentation) {
      clearPendingPresentationSelection();
      return;
    }

    const selectedFile = files?.[0];
    if (!selectedFile) {
      return;
    }

    const validationError = validatePresentationFile(selectedFile);
    if (validationError) {
      toast({
        title: "Invalid PPT Submission",
        description: validationError,
        variant: "destructive",
      });
      clearPendingPresentationSelection();
      return;
    }

    setPendingPresentationFile(selectedFile);
    setShowPresentationConfirm(true);
  };

  const submitPresentation = async () => {
    if (!pendingPresentationFile || isSubmittingPresentation) {
      return;
    }

    const validationError = validatePresentationFile(pendingPresentationFile);
    if (validationError) {
      toast({
        title: "Invalid PPT Submission",
        description: validationError,
        variant: "destructive",
      });
      clearPendingPresentationSelection();
      setShowPresentationConfirm(false);
      return;
    }

    setIsSubmittingPresentation(true);

    try {
      const formData = new FormData();
      formData.set("file", pendingPresentationFile);

      const response = await fetch(`/api/register/${teamId}/presentation`, {
        body: formData,
        method: "POST",
      });
      const data = (await response.json()) as {
        error?: string;
        team?: TeamRecord;
      };

      if (!response.ok || !data.team) {
        if (response.status === 409) {
          toast({
            title: "Presentation Already Submitted",
            description:
              data.error ??
              "This team already has a submitted presentation and is now view-only.",
          });
          try {
            const teamResponse = await fetch(`/api/register/${teamId}`, {
              method: "GET",
            });
            const teamData = (await teamResponse.json()) as {
              team?: TeamRecord;
            };
            if (teamResponse.ok && teamData.team) {
              setUpdatedAt(teamData.team.updatedAt);
              setTeamApprovalStatusFromDb(
                normalizeApprovalStatus(teamData.team.approvalStatus),
              );
              setPresentationFromTeam(teamData.team);
            }
          } catch {
            // no-op: best effort refresh only
          }
          clearPendingPresentationSelection();
          setShowPresentationConfirm(false);
          return;
        }

        toast({
          title: "PPT Submission Failed",
          description:
            data.error ??
            "We couldn't submit your presentation right now. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setUpdatedAt(data.team.updatedAt);
      setTeamApprovalStatusFromDb(
        normalizeApprovalStatus(data.team.approvalStatus),
      );
      setPresentationFromTeam(data.team);
      clearPendingPresentationSelection();
      setShowPresentationConfirm(false);
      toast({
        title: "Presentation Submitted",
        description:
          "Your PPT submission is complete. This submission is now view-only.",
        variant: "success",
      });
    } catch {
      toast({
        title: "PPT Submission Failed",
        description:
          "Network issue while submitting your PPT. Please retry once connected.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingPresentation(false);
    }
  };

  const deleteTeam = async () => {
    if (isDeleting || !canConfirmDelete) {
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
        closeDeleteConfirm();
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

  const openDeleteConfirm = () => {
    setDeleteConfirmationStep("confirm");
    setDeleteConfirmationInput("");
    setShowDeleteConfirm(true);
  };

  const closeDeleteConfirm = () => {
    setShowDeleteConfirm(false);
    setDeleteConfirmationStep("confirm");
    setDeleteConfirmationInput("");
  };

  const proceedDeleteToTypeStep = () => {
    setDeleteConfirmationStep("type");
  };

  const backDeleteToConfirmStep = () => {
    setDeleteConfirmationStep("confirm");
  };

  const goToTab = (tab: DashboardTab) => {
    router.replace(
      buildDashboardTabUrl({
        tab,
        teamId,
      }),
    );
  };

  const copyTeamId = async () => {
    const fallbackCopy = () => {
      if (typeof document === "undefined") {
        return false;
      }

      const textarea = document.createElement("textarea");
      textarea.value = teamId;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    };

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.writeText === "function"
      ) {
        await navigator.clipboard.writeText(teamId);
      } else if (!fallbackCopy()) {
        throw new Error("Clipboard unavailable");
      }

      toast({
        title: "Team ID Copied",
        description: "Copied team ID to clipboard.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Copy Failed",
        description:
          "Couldn't copy the team ID automatically. Please copy it manually.",
        variant: "destructive",
      });
    }
  };

  const openTeamTicketModal = () => {
    if (!shouldShowAcceptedQr || !teamIdQrDataUrl || teamQrGenerationError) {
      return;
    }

    setShowTeamTicketModal(true);
  };

  const closeTeamTicketModal = () => {
    setShowTeamTicketModal(false);
  };

  const downloadTeamTicket = async () => {
    if (isDownloadingTeamTicket || !teamIdQrDataUrl) {
      return;
    }

    setIsDownloadingTeamTicket(true);
    try {
      const ticketDataUrl =
        teamTicketPreviewDataUrl ||
        (await buildAcceptedTeamTicketDataUrl({
          qrDataUrl: teamIdQrDataUrl,
          statementTitle: problemStatement.title || "No track selected",
          teamId,
          teamName: teamName || "Unnamed Team",
        }));

      if (typeof document === "undefined") {
        throw new Error("Document unavailable");
      }

      const anchor = document.createElement("a");
      anchor.href = ticketDataUrl;
      anchor.download = `foundathon-ticket-${teamId.replace(/[^a-zA-Z0-9_-]/g, "-")}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      toast({
        title: "Ticket Downloaded",
        description: "Your QR ticket has been downloaded successfully.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Ticket Download Failed",
        description:
          "Couldn't generate the ticket right now. Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsDownloadingTeamTicket(false);
    }
  };

  const shareTeamTicketOnWhatsApp = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const dashboardUrl = `${window.location.origin}/dashboard/${teamId}`;
    const message = [
      "Foundathon 3.0 - Accepted Team Ticket",
      `Team: ${teamName || "Unnamed Team"}`,
      `Team ID: ${teamId}`,
      `Track: ${problemStatement.title || "N/A"}`,
      `Dashboard: ${dashboardUrl}`,
    ].join("\n");
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    const redirectToWhatsApp = () => {
      const openedWindow = window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer",
      );
      if (!openedWindow) {
        window.location.assign(whatsappUrl);
      }
    };

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      teamIdQrDataUrl
    ) {
      setIsSharingTeamTicket(true);
      try {
        const ticketDataUrl =
          teamTicketPreviewDataUrl ||
          (await buildAcceptedTeamTicketDataUrl({
            qrDataUrl: teamIdQrDataUrl,
            statementTitle: problemStatement.title || "No track selected",
            teamId,
            teamName: teamName || "Unnamed Team",
          }));

        const response = await fetch(ticketDataUrl);
        const ticketBlob = await response.blob();
        const ticketFile = new File(
          [ticketBlob],
          `foundathon-ticket-${teamId.replace(/[^a-zA-Z0-9_-]/g, "-")}.png`,
          {
            type: "image/png",
          },
        );

        const canShareTicket =
          typeof navigator.canShare === "function"
            ? navigator.canShare({ files: [ticketFile] })
            : false;

        if (canShareTicket) {
          await navigator.share({
            files: [ticketFile],
            text: message,
            title: "Foundathon 3.0 - Accepted Team Ticket",
          });
          return;
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
      } finally {
        setIsSharingTeamTicket(false);
      }
    }

    redirectToWhatsApp();
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
  const canSubmitPresentation =
    hasLockedProblemStatement &&
    !isPresentationSubmitted &&
    !isSubmittingPresentation &&
    !isLoading;
  const teamApprovalStatusMeta = getTeamApprovalStatusMeta(
    resolvedTeamApprovalStatus,
  );
  const presentationLeadEmailLabel = presentationLeadEmail || "lead email";
  const activeTabMeta =
    DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0];
  const memberIdLabel = teamType === "srm" ? "NetID" : "College ID";
  const copyTeamIdButtonClass =
    "inline-flex size-7 items-center justify-center rounded-md border border-foreground/20 bg-white text-foreground/70 transition-colors hover:bg-fnblue/10 hover:text-fnblue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/50";

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
            {activeTabMeta.description}
          </p>
        </header>

        {/* <section className="mb-6 rounded-2xl border border-b-4 border-fnblue bg-background/95 p-4 shadow-lg md:p-5 flex flex-col items-center"> */}
        <section className="mb-6 flex flex-col items-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnblue">
            Dashboard Sections
          </p>
          <div
            className="mt-3 rounded-xl border border-fnblue/20 bg-linear-to-r from-fnblue/5 v to-fnyellow/10 p-2 inline-flex"
            role="tablist"
            aria-label="Team dashboard sections"
          >
            <div className="flex gap-2 overflow-x-auto pb-1">
              {DASHBOARD_TABS.map((tab) => {
                const isSelected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`dashboard-tab-${tab.id}`}
                    type="button"
                    role="tab"
                    aria-controls={`dashboard-panel-${tab.id}`}
                    aria-selected={isSelected}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => goToTab(tab.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-black uppercase tracking-[0.08em] transition-colors ${
                      isSelected
                        ? "bg-fnblue text-white shadow-sm"
                        : "bg-white/80 text-foreground/75 hover:bg-white hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {activeTab === "overview" ? (
          <section
            id="dashboard-panel-overview"
            role="tabpanel"
            aria-labelledby="dashboard-tab-overview"
            className="space-y-6"
          >
            <section
              className={`relative overflow-visible rounded-2xl border border-b-4 p-5 shadow-lg md:p-6 ${teamApprovalStatusMeta.panelClass}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">
                    Team Review Status
                  </p>
                  <div
                    className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${teamApprovalStatusMeta.badgeClass}`}
                  >
                    <span
                      className={`inline-flex size-2 rounded-full ${teamApprovalStatusMeta.dotClass}`}
                    />
                    {teamApprovalStatusMeta.label}
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/80 md:text-base">
                    {teamApprovalStatusMeta.description}
                  </p>
                </div>

                <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
                  <div className="relative group self-end">
                    <button
                      type="button"
                      aria-label="Status meaning"
                      className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/20 bg-white/85 text-foreground/75 transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45"
                    >
                      <Info size={16} strokeWidth={2.6} />
                    </button>
                    <div
                      role="tooltip"
                      className="pointer-events-none absolute right-0 z-20 mt-2 w-72 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-xs leading-relaxed text-foreground/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {teamApprovalStatusMeta.label}:{" "}
                      {teamApprovalStatusMeta.description}
                    </div>
                  </div>

                  {shouldShowAcceptedQr ? (
                    <div className="w-full rounded-xl border border-fngreen/35 bg-white/90 p-3 shadow-sm md:w-[220px]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fngreen">
                        Team Ticket
                      </p>
                      {isGeneratingTeamQr ? (
                        <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                          Preparing accepted-team QR...
                        </p>
                      ) : teamQrGenerationError ? (
                        <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                          Couldn&apos;t generate QR code right now. Please
                          refresh once.
                        </p>
                      ) : null}
                      <FnButton
                        type="button"
                        tone="green"
                        size="sm"
                        className="mt-3 w-full justify-center"
                        onClick={openTeamTicketModal}
                        disabled={isGeneratingTeamQr || teamQrGenerationError}
                      >
                        View QR Ticket
                      </FnButton>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section
              className={`relative overflow-hidden rounded-2xl border border-b-4 p-6 md:p-8 shadow-xl ${
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
                    : "No statement lock is attached to this team record yet. Move to Manage Team to complete your lock and continue."}
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

            <section className="relative overflow-hidden rounded-2xl border border-b-4 border-fnorange bg-background/95 p-6 shadow-lg">
              <div className="absolute -top-10 right-0 size-36 rounded-full bg-fnorange/10 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-8 size-32 rounded-full bg-fnblue/10 blur-3xl pointer-events-none" />

              <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnorange">
                    Team Snapshot
                  </p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                    Continue Team Operations
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                    Manage roster updates from Manage Team and complete one-time
                    PPT operations from Actions.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-fnblue/35 bg-fnblue/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fnblue">
                      {teamTypeLabel}
                    </span>
                    <span className="rounded-full border border-fngreen/35 bg-fngreen/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fngreen">
                      {memberCount}/5 Members
                    </span>
                    <span className="rounded-full border border-fnorange/35 bg-fnorange/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fnorange">
                      {completedProfiles}/{memberCount} Complete
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <FnButton type="button" onClick={() => goToTab("manage")}>
                      Go to Manage Team
                    </FnButton>
                    <FnButton
                      type="button"
                      tone="yellow"
                      onClick={() => goToTab("actions")}
                    >
                      Go to Actions
                    </FnButton>
                  </div>
                </div>

                <div className="rounded-xl border border-fnorange/25 bg-white/75 p-4 backdrop-blur-xs">
                  <div className="grid gap-2 text-sm">
                    <MetricRow label="Team Name" value={teamName || "N/A"} />
                    <div className="flex items-center justify-between gap-4 border-b border-foreground/10 py-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65">
                        Team ID
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs text-right">{teamId}</p>
                        <button
                          type="button"
                          aria-label="Copy Team ID"
                          title="Copy Team ID"
                          className={copyTeamIdButtonClass}
                          onClick={copyTeamId}
                        >
                          <Copy size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                    <MetricRow
                      label="Lead"
                      value={
                        (teamType === "srm" ? leadSrm.name : leadNonSrm.name) ||
                        "N/A"
                      }
                    />
                    <MetricRow
                      label="Lead ID"
                      value={currentLeadId || "N/A"}
                      mono
                    />
                    <MetricRow
                      label="Last Updated"
                      value={formatDateTime(updatedAt)}
                    />
                    {teamType === "non_srm" ? (
                      <>
                        <MetricRow
                          label="College"
                          value={metaNonSrm.collegeName || "N/A"}
                        />
                        <MetricRow
                          label="Club"
                          value={
                            metaNonSrm.isClub
                              ? metaNonSrm.clubName || "Club team"
                              : "Independent Team"
                          }
                        />
                      </>
                    ) : null}
                    <MetricRow
                      label="Created"
                      value={formatDateTime(createdAt)}
                      noBorder
                    />
                  </div>
                </div>
              </div>

              <div className="relative mt-6 border-t border-foreground/10 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnyellow">
                    Members Snapshot
                  </p>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground/65">
                    Total: {memberCount}
                  </p>
                </div>

                <div className="mt-3 overflow-x-auto rounded-xl border border-foreground/10 bg-white/80">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-foreground/10 bg-fnblue/5 text-left">
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Name</th>
                        <th className="py-2.5 px-3">{memberIdLabel}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-foreground/10 hover:bg-fnblue/5">
                        <td className="py-2.5 px-3">
                          <span className="inline-flex rounded-full border border-fnblue/35 bg-fnblue/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fnblue">
                            Lead
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          {(teamType === "srm"
                            ? leadSrm.name
                            : leadNonSrm.name) || "-"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-xs">
                          {currentLeadId || "-"}
                        </td>
                      </tr>
                      {currentMembers.map((member, idx) => (
                        <tr
                          key={`${getCurrentMemberId(member)}-${idx}`}
                          className="border-b border-foreground/10 hover:bg-fnblue/5 last:border-b-0"
                        >
                          <td className="py-2.5 px-3">
                            <span className="inline-flex rounded-full border border-fnorange/35 bg-fnorange/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-fnorange">
                              M{idx + 1}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {member.name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs">
                            {getCurrentMemberId(member)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "rules" ? (
          <section
            id="dashboard-panel-rules"
            role="tabpanel"
            aria-labelledby="dashboard-tab-rules"
            className="space-y-6 font-sans"
          >
            <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-fnblue">
                Rules
              </p>
              <h2 className="mt-3 text-3xl font-black tracking-tight">
                Operating Rules for Team Dashboard
              </h2>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/75">
                These rules define how your team progresses through statement
                lock, roster management, and one-time presentation submission.
              </p>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              {DASHBOARD_RULE_GROUPS.map((group) => (
                <section
                  key={group.id}
                  className="rounded-2xl border border-b-4 border-fngreen/45 bg-white p-6 shadow-lg"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fngreen">
                    {group.label}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-foreground/70">
                    {group.description}
                  </p>
                  <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/85">
                    {group.items.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-1 inline-flex size-1.5 shrink-0 rounded-full bg-fnblue" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <section className="rounded-2xl border border-b-4 border-fnred bg-fnred/5 p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fnred">
                Irreversible Actions
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-fnred/40 bg-fnred/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fnred">
                  Problem Lock: Once
                </span>
                <span className="rounded-full border border-fnred/40 bg-fnred/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fnred">
                  PPT Submission: Once
                </span>
                <span className="rounded-full border border-fnred/40 bg-fnred/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-fnred">
                  Team Delete: Permanent
                </span>
              </div>
            </section>
          </section>
        ) : null}

        {activeTab === "manage" ? (
          <section
            id="dashboard-panel-manage"
            role="tabpanel"
            aria-labelledby="dashboard-tab-manage"
            className="space-y-6"
          >
            {!hasLockedProblemStatement ? (
              <section className="rounded-2xl border border-b-4 border-fnred bg-background/95 p-6 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fnred">
                  Legacy Team Action Required
                </p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                  lock a problem statement now
                </h3>
                <p className="mt-2 text-sm text-foreground/75 md:text-base">
                  This team was registered before statement locking was
                  introduced. Choose one statement below to complete your team
                  profile.
                </p>
                <p className="mt-2 text-sm font-semibold text-fnred">
                  This is a one-time action. Once locked, the problem statement
                  cannot be changed.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {isLoadingStatements
                    ? ["one", "two", "three", "four"].map((item) => (
                        <div
                          key={`legacy-statement-skeleton-${item}`}
                          className="h-40 animate-pulse rounded-xl border border-b-4 border-fnblue/40 bg-foreground/5"
                        />
                      ))
                    : problemStatements.map((statement, index) => (
                        <div
                          key={statement.id}
                          className="group relative overflow-hidden rounded-xl border border-b-4 border-fnblue/45 bg-gradient-to-br from-white via-white to-fnblue/5 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="absolute -right-8 -top-8 size-24 rounded-full bg-fnyellow/15 blur-2xl pointer-events-none" />
                          <p className="relative text-[11px] font-semibold uppercase tracking-[0.16em] text-fnblue/75">
                            Track {index + 1}
                          </p>
                          <h4 className="relative mt-1 text-sm font-black uppercase tracking-[0.04em] leading-snug">
                            {statement.title}
                          </h4>
                          <p className="relative mt-2 text-xs text-foreground/75 leading-relaxed">
                            {statement.summary}
                          </p>
                          <div className="relative mt-4">
                            {statement.isFull ? (
                              <FnButton type="button" tone="gray" disabled>
                                Full
                              </FnButton>
                            ) : (
                              <FnButton
                                type="button"
                                onClick={() =>
                                  requestLegacyProblemStatementLock(
                                    statement.id,
                                    statement.title,
                                  )
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

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnblue">
                  Manage Team
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight uppercase">
                  Manage Team Roster
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                  Add, edit, and remove member profiles. Team identity fields
                  are locked after registration.
                </p>

                <div className="mt-6 rounded-xl border border-b-4 border-fnblue/40 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnblue">
                    Locked Team Profile
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                    These fields are locked after team creation: Team Name, Lead
                    Details
                    {teamType === "non_srm" ? ", College + Club Profile." : "."}
                  </p>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                    <div className="rounded-md border border-foreground/12 bg-foreground/5 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                        Team Name
                      </p>
                      <p className="mt-1 font-semibold">{teamName || "N/A"}</p>
                    </div>
                    <div className="rounded-md border border-foreground/12 bg-foreground/5 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                        Team Type
                      </p>
                      <p className="mt-1 font-semibold">{teamTypeLabel}</p>
                    </div>
                    <div className="rounded-md border border-foreground/12 bg-foreground/5 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                        Lead Name
                      </p>
                      <p className="mt-1 font-semibold">
                        {(teamType === "srm"
                          ? leadSrm.name
                          : leadNonSrm.name) || "N/A"}
                      </p>
                    </div>
                    <div className="rounded-md border border-foreground/12 bg-foreground/5 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                        Lead ID
                      </p>
                      <p className="mt-1 font-semibold">
                        {currentLeadId || "N/A"}
                      </p>
                    </div>
                    {teamType === "non_srm" ? (
                      <>
                        <div className="rounded-md border border-foreground/12 bg-foreground/5 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                            College Name
                          </p>
                          <p className="mt-1 font-semibold">
                            {metaNonSrm.collegeName || "N/A"}
                          </p>
                        </div>
                        <div className="rounded-md border border-foreground/12 bg-foreground/5 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-foreground/70">
                            Club Profile
                          </p>
                          <p className="mt-1 font-semibold">
                            {metaNonSrm.isClub
                              ? metaNonSrm.clubName || "Club team"
                              : "Independent Team"}
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                {teamType === "srm" ? (
                  <SrmEditor
                    title="Member Draft"
                    member={draftSrm}
                    onChange={(field, value) =>
                      setDraftSrm(
                        (prev) => ({ ...prev, [field]: value }) as SrmMember,
                      )
                    }
                    className="mt-6 border-b-4 border-fngreen/45"
                  />
                ) : (
                  <NonSrmEditor
                    title="Member Draft"
                    member={draftNonSrm}
                    onChange={(field, value) =>
                      setDraftNonSrm(
                        (prev) => ({ ...prev, [field]: value }) as NonSrmMember,
                      )
                    }
                    className="mt-6 border-b-4 border-fngreen/45"
                  />
                )}

                {editingIndex !== null ? (
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
                            (prev) =>
                              ({ ...prev, [field]: value }) as SrmMember,
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
                            (prev) =>
                              ({ ...prev, [field]: value }) as NonSrmMember,
                          )
                        }
                        className="border-b-4 border-fnorange/45"
                      />
                    )}
                    <div className="mt-3 flex gap-2">
                      <FnButton
                        type="button"
                        onClick={saveEditMember}
                        size="sm"
                      >
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
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  {formError ? (
                    <p className="w-full rounded-md border border-fnred/35 bg-fnred/10 px-3 py-2 text-sm font-semibold text-fnred">
                      {formError}
                    </p>
                  ) : null}
                  <p
                    className={`w-full text-xs font-semibold uppercase tracking-[0.16em] ${
                      hasUnsavedMemberChanges ? "text-fnorange" : "text-fngreen"
                    }`}
                  >
                    {hasUnsavedMemberChanges
                      ? "Unsaved roster changes"
                      : "Roster synced"}
                  </p>
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
                    disabled={
                      isSaving ||
                      isDeleting ||
                      isAssigningStatement ||
                      !hasUnsavedMemberChanges
                    }
                    tone={hasUnsavedMemberChanges ? "blue" : "gray"}
                  >
                    {hasUnsavedMemberChanges
                      ? "Save Member Changes"
                      : "All Changes Saved"}
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={openDeleteConfirm}
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
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-sm font-semibold">Team ID: {teamId}</p>
                    <button
                      type="button"
                      aria-label="Copy Team ID"
                      title="Copy Team ID"
                      className={copyTeamIdButtonClass}
                      onClick={copyTeamId}
                    >
                      <Copy size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                  <p className="text-sm font-semibold">
                    Lead:{" "}
                    {(teamType === "srm" ? leadSrm.name : leadNonSrm.name) ||
                      "N/A"}
                  </p>
                  <p className="text-sm font-semibold">
                    Lead ID: {currentLeadId || "N/A"}
                  </p>
                  {teamType === "non_srm" ? (
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
                  ) : null}
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
                          <th className="py-2 pr-3">{memberIdLabel}</th>
                          <th className="py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-foreground/10">
                          <td className="py-2 pr-3 font-bold text-fnblue">
                            Lead
                          </td>
                          <td className="py-2 pr-3">
                            {(teamType === "srm"
                              ? leadSrm.name
                              : leadNonSrm.name) || "-"}
                          </td>
                          <td className="py-2 pr-3">{currentLeadId || "-"}</td>
                          <td className="py-2 text-right text-foreground/40">
                            -
                          </td>
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
              </aside>
            </div>
          </section>
        ) : null}

        {activeTab === "actions" ? (
          <section
            id="dashboard-panel-actions"
            role="tabpanel"
            aria-labelledby="dashboard-tab-actions"
            className="space-y-6"
          >
            <section className="rounded-2xl border border-b-4 border-fnorange bg-background/95 p-6 shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnorange">
                Actions
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight uppercase">
                PPT Submission Controls
              </h2>
              <p className="mt-2 text-sm text-foreground/75 md:text-base">
                Download the official template and manage one-time PPT
                submission for your team.
              </p>
              <div className="mt-4">
                <FnButton asChild tone="yellow">
                  <a href={PRESENTATION_TEMPLATE_PATH} download>
                    <Download size={16} strokeWidth={3} />
                    Download PPT Template
                  </a>
                </FnButton>
              </div>
            </section>

            {!hasLockedProblemStatement ? (
              <section className="rounded-2xl border border-b-4 border-fnred bg-background/95 p-6 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnred">
                  Submission Blocked
                </p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                  lock a problem statement first
                </h3>
                <p className="mt-2 text-sm text-foreground/75 md:text-base">
                  PPT submission is enabled only after your team has an official
                  locked problem statement.
                </p>
                <div className="mt-4">
                  <FnButton type="button" onClick={() => goToTab("manage")}>
                    Go to Manage Team
                  </FnButton>
                </div>
              </section>
            ) : (
              <section className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-6 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fngreen">
                  Presentation Submission
                </p>
                <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                  submit your PPT for review
                </h3>
                <p className="mt-2 text-sm text-foreground/75 md:text-base">
                  Submit your PPT for review. An admin will approve your
                  participation soon. You may receive approval mail on{" "}
                  <span className="font-semibold text-foreground">
                    {presentationLeadEmailLabel}
                  </span>
                  .
                </p>
                <p className="mt-2 text-sm font-semibold text-fnred">
                  This can only be done once. After submission, you cannot
                  change your PPT.
                </p>

                <input
                  ref={presentationFileInputRef}
                  type="file"
                  accept=".ppt,.pptx"
                  className="hidden"
                  onChange={(event) =>
                    handlePresentationFileChange(event.target.files)
                  }
                />

                {isPresentationSubmitted ? (
                  <div className="mt-5 rounded-xl border border-b-4 border-fngreen/45 bg-fngreen/5 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-fngreen">
                      Submitted
                    </p>
                    <p className="mt-2 text-sm font-semibold">
                      File: {presentation.fileName || "N/A"}
                    </p>
                    <p className="text-sm">
                      Uploaded: {formatDateTime(presentation.uploadedAt)}
                    </p>
                    <p className="text-sm">
                      Size: {formatBytes(presentation.fileSizeBytes)}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <FnButton
                        type="button"
                        tone="blue"
                        onClick={() => setShowPresentationPreview(true)}
                        disabled={!presentationPreviewUrl}
                      >
                        Preview Uploaded PPT
                      </FnButton>
                      <FnButton asChild tone="gray">
                        <a
                          href={presentation.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink size={16} strokeWidth={3} />
                          Open in New Tab
                        </a>
                      </FnButton>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-xl border border-b-4 border-fnorange/45 bg-fnorange/5 p-4">
                    <p className="text-sm text-foreground/75">
                      Accepted format: `.ppt` or `.pptx` up to 5 MB.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <FnButton
                        type="button"
                        onClick={() =>
                          presentationFileInputRef.current?.click()
                        }
                        tone="blue"
                        disabled={!canSubmitPresentation}
                      >
                        Select PPT File
                      </FnButton>
                      {pendingPresentationFile ? (
                        <p className="text-sm font-semibold text-foreground/80">
                          Selected: {pendingPresentationFile.name}
                        </p>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>
        ) : null}
      </div>

      {showTeamTicketModal && shouldShowAcceptedQr ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-ticket-title"
        >
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-b-4 border-fngreen bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 md:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fngreen">
                  Accepted Team Pass
                </p>
                <h3
                  id="team-ticket-title"
                  className="mt-1 text-lg font-black uppercase tracking-tight md:text-xl"
                >
                  Team QR Ticket
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close team ticket modal"
                onClick={closeTeamTicketModal}
                className="inline-flex size-8 items-center justify-center rounded-md border border-foreground/20 bg-white text-foreground/70 transition-colors hover:bg-fnblue/10 hover:text-fnblue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/40"
              >
                <X size={16} strokeWidth={2.6} />
              </button>
            </div>

            <div className="grid gap-5 bg-white/70 p-4 md:grid-cols-[1.2fr_0.8fr] md:p-5">
              <div className="rounded-xl border border-foreground/10 bg-foreground/5 p-3">
                {isGeneratingTeamTicketPreview ? (
                  <div className="h-[220px] w-full animate-pulse rounded-lg bg-foreground/10 md:h-[260px]" />
                ) : teamTicketPreviewError ? (
                  <div className="flex h-[220px] flex-col items-center justify-center rounded-lg border border-fnred/25 bg-fnred/5 px-4 text-center md:h-[260px]">
                    <p className="text-sm font-semibold text-fnred">
                      Ticket preview unavailable right now.
                    </p>
                    <p className="mt-2 text-xs text-foreground/75">
                      You can still download and share using the actions on the
                      right.
                    </p>
                  </div>
                ) : teamTicketPreviewDataUrl ? (
                  <Image
                    src={teamTicketPreviewDataUrl}
                    alt={`Ticket preview for team ${teamName || teamId}`}
                    width={1200}
                    height={675}
                    unoptimized
                    className="w-full rounded-lg border border-foreground/10 bg-white"
                  />
                ) : (
                  <div className="flex h-[220px] items-center justify-center rounded-lg border border-foreground/10 bg-background text-sm text-foreground/75 md:h-[260px]">
                    Ticket preview is being prepared.
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border border-foreground/10 bg-background p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fngreen">
                  Ticket Details
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Team:</span>{" "}
                  {teamName || "Unnamed Team"}
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Team ID:</span>{" "}
                  <span className="font-mono text-xs">{teamId}</span>
                </p>
                <p className="text-sm">
                  <span className="font-semibold">Track:</span>{" "}
                  {problemStatement.title || "N/A"}
                </p>
                <p className="text-xs text-foreground/70">
                  Download this hot ticket layout for on-ground check-ins or
                  share the accepted team details instantly on WhatsApp.
                </p>

                <div className="pt-1 space-y-2">
                  <FnButton
                    type="button"
                    className="w-full justify-center"
                    onClick={downloadTeamTicket}
                    loading={isDownloadingTeamTicket}
                    loadingText="Preparing Ticket..."
                    disabled={isGeneratingTeamQr || teamQrGenerationError}
                  >
                    <Download size={16} strokeWidth={3} />
                    Download Ticket PNG
                  </FnButton>
                  <FnButton
                    type="button"
                    tone="green"
                    className="w-full justify-center"
                    onClick={shareTeamTicketOnWhatsApp}
                    loading={isSharingTeamTicket}
                    loadingText="Opening Share..."
                    disabled={
                      isGeneratingTeamQr ||
                      teamQrGenerationError ||
                      isSharingTeamTicket
                    }
                  >
                    <ExternalLink size={16} strokeWidth={3} />
                    Share on WhatsApp
                  </FnButton>
                  <FnButton
                    type="button"
                    tone="gray"
                    className="w-full justify-center"
                    onClick={copyTeamId}
                  >
                    Copy Team ID
                  </FnButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showPresentationPreview && isPresentationSubmitted ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="presentation-preview-title"
        >
          <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-b-4 border-fnblue bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 md:px-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fnblue">
                  Presentation Preview
                </p>
                <h3
                  id="presentation-preview-title"
                  className="mt-1 text-lg font-black uppercase tracking-tight md:text-xl"
                >
                  {presentation.fileName || "Uploaded PPT"}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close presentation preview"
                onClick={() => setShowPresentationPreview(false)}
                className="inline-flex size-8 items-center justify-center rounded-md border border-foreground/20 bg-white text-foreground/70 transition-colors hover:bg-fnblue/10 hover:text-fnblue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/40"
              >
                <X size={16} strokeWidth={2.6} />
              </button>
            </div>

            <div className="relative flex-1 bg-slate-100">
              {presentationPreviewUrl ? (
                <iframe
                  title="Uploaded team presentation preview"
                  src={presentationPreviewUrl}
                  className="h-full w-full"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/75">
                  Preview is unavailable for this file right now.
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-foreground/10 bg-white/85 px-4 py-3">
              <p className="text-xs text-foreground/70">
                If preview does not load, open the uploaded file directly.
              </p>
              <div className="flex gap-2">
                <FnButton asChild tone="gray" size="sm">
                  <a
                    href={presentation.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} strokeWidth={3} />
                    Open in New Tab
                  </a>
                </FnButton>
                <FnButton
                  type="button"
                  size="sm"
                  onClick={() => setShowPresentationPreview(false)}
                >
                  Close
                </FnButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showPresentationConfirm && pendingPresentationFile ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="presentation-submit-title"
        >
          <div className="w-full max-w-md rounded-xl border border-b-4 border-fnred bg-background p-6 shadow-xl">
            <p
              id="presentation-submit-title"
              className="text-sm uppercase tracking-[0.18em] font-bold text-fnred"
            >
              Confirm PPT Submission
            </p>
            <p className="mt-3 text-sm text-foreground/80">
              This action cannot be reverted. Are you sure you want to submit
              this presentation?
            </p>
            <p className="mt-3 rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-semibold">
              {pendingPresentationFile.name}
            </p>
            <p className="mt-2 text-xs text-foreground/70">
              Once submitted, this team can only view the uploaded PPT and
              cannot replace it.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <FnButton
                type="button"
                onClick={() => {
                  clearPendingPresentationSelection();
                  setShowPresentationConfirm(false);
                }}
                tone="gray"
                size="sm"
                disabled={isSubmittingPresentation}
              >
                Cancel
              </FnButton>
              <FnButton
                type="button"
                onClick={submitPresentation}
                tone="red"
                size="sm"
                loading={isSubmittingPresentation}
                loadingText="Submitting..."
                disabled={isSubmittingPresentation}
              >
                Submit PPT
              </FnButton>
            </div>
          </div>
        </div>
      ) : null}

      {pendingLockProblemStatement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legacy-lock-title"
        >
          <div className="w-full max-w-md rounded-xl border border-b-4 border-fnred bg-background p-6 shadow-xl">
            <p
              id="legacy-lock-title"
              className="text-sm uppercase tracking-[0.18em] font-bold text-fnred"
            >
              Confirm Problem Statement Lock
            </p>
            <p className="mt-3 text-sm text-foreground/80">
              This action cannot be reverted. Are you sure you want to lock this
              problem statement?
            </p>
            <p className="mt-3 rounded-md border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-semibold">
              {pendingLockProblemStatement.title}
            </p>
            {legacyLockConfirmationStep === "confirm" ? (
              <div className="mt-6 flex justify-end gap-2">
                <FnButton
                  type="button"
                  onClick={closeLegacyLockConfirm}
                  tone="gray"
                  size="sm"
                >
                  Cancel
                </FnButton>
                <FnButton
                  type="button"
                  onClick={proceedLegacyLockToTypeStep}
                  tone="red"
                  size="sm"
                >
                  Continue
                </FnButton>
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs text-foreground/70">
                  Type{" "}
                  <span className="font-mono">
                    {legacyLockConfirmationPhrase}
                  </span>{" "}
                  to continue.
                </p>
                <input
                  type="text"
                  value={legacyLockConfirmationInput}
                  onChange={(event) =>
                    setLegacyLockConfirmationInput(event.target.value)
                  }
                  placeholder={legacyLockConfirmationPhrase}
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
                />
                <div className="mt-6 flex justify-end gap-2">
                  <FnButton
                    type="button"
                    onClick={backLegacyLockToConfirmStep}
                    tone="gray"
                    size="sm"
                  >
                    Back
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={confirmLegacyProblemStatementLock}
                    tone="red"
                    size="sm"
                    disabled={!canConfirmLegacyLock}
                  >
                    Yes, Lock Statement
                  </FnButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
            {deleteConfirmationStep === "confirm" ? (
              <div className="mt-6 flex justify-end gap-2">
                <FnButton
                  type="button"
                  onClick={closeDeleteConfirm}
                  tone="gray"
                  size="sm"
                  disabled={isDeleting}
                >
                  Cancel
                </FnButton>
                <FnButton
                  type="button"
                  onClick={proceedDeleteToTypeStep}
                  tone="red"
                  size="sm"
                  disabled={isDeleting}
                >
                  Continue
                </FnButton>
              </div>
            ) : (
              <>
                <p className="mt-3 text-xs text-foreground/70">
                  Type{" "}
                  <span className="font-mono">{deleteConfirmationPhrase}</span>{" "}
                  to continue.
                </p>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(event) =>
                    setDeleteConfirmationInput(event.target.value)
                  }
                  placeholder={deleteConfirmationPhrase}
                  className="mt-2 w-full rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
                />
                <div className="mt-6 flex justify-end gap-2">
                  <FnButton
                    type="button"
                    onClick={backDeleteToConfirmStep}
                    tone="gray"
                    size="sm"
                    disabled={isDeleting}
                  >
                    Back
                  </FnButton>
                  <FnButton
                    type="button"
                    onClick={deleteTeam}
                    tone="red"
                    size="sm"
                    loading={isDeleting}
                    loadingText="Deleting..."
                    disabled={isDeleting || !canConfirmDelete}
                  >
                    <Trash2 size={16} strokeWidth={3} />
                    Delete Team
                  </FnButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <datalist id={SRM_DEPARTMENT_DATALIST_ID}>
        {SRM_MAJOR_DEPARTMENTS.map((department) => (
          <option key={department} value={department} />
        ))}
      </datalist>
    </main>
  );
}
type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  list?: string;
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

const MetricRow = ({
  label,
  value,
  mono = false,
  noBorder = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  noBorder?: boolean;
}) => (
  <div
    className={`flex items-center justify-between gap-4 py-1.5 ${
      noBorder ? "" : "border-b border-foreground/10"
    }`}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground/65">
      {label}
    </p>
    <p
      className={`text-right ${
        mono
          ? "font-mono text-xs"
          : "text-sm font-black uppercase tracking-[0.06em]"
      }`}
    >
      {value}
    </p>
  </div>
);

const Input = ({
  label,
  value,
  onChange,
  list,
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
      list={list}
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
        onChange={(v) => onChange("raNumber", v.toUpperCase())}
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
        onChange={(v) => onChange("dept", v.toUpperCase())}
        list={SRM_DEPARTMENT_DATALIST_ID}
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
