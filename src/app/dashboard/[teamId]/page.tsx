"use client";

import {
  Copy,
  Download,
  ExternalLink,
  Info,
  PlusIcon,
  QrCode,
  Trash2,
  UserRoundPen,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import QRCode from "qrcode";
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
import { MOTION_TRANSITIONS, MOTION_VARIANTS } from "@/lib/motion-system";
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
import { cn } from "@/lib/utils";
import {
  DASHBOARD_EVENT_VENUES,
  DASHBOARD_EVENT_OVERVIEW,
  DASHBOARD_QUICK_RULES,
  DASHBOARD_RULE_SECTIONS,
} from "./dashboard-rules";
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
type TeamTicketThemeId =
  | "aurora-mint"
  | "crimson-heat"
  | "neon-royale"
  | "monopoly-classic";
type TeamTicketLayoutId =
  | "command-split"
  | "poster-stack"
  | "ops-grid"
  | "boardwalk-pass";
type TeamTicketTheme = {
  accentGlowColor: string;
  cardStops: readonly [string, string, string];
  cardStrokeColor: string;
  layout: TeamTicketLayoutId;
  headingColor: string;
  id: TeamTicketThemeId;
  issuedTextColor: string;
  label: string;
  metaLabelColor: string;
  noiseDotColor: string;
  punchColor: string;
  qrFrameFillColor: string;
  qrHintColor: string;
  qrPanelFillColor: string;
  qrPanelStrokeColor: string;
  qrTitleColor: string;
  statementTextColor: string;
  statusBgColor: string;
  statusTextColor: string;
  swatchClass: string;
  teamIdTextColor: string;
  teamTextColor: string;
  titleColor: string;
  backdropStops: readonly [string, string, string];
  description: string;
  splitStrokeColor: string;
  uiAccentTextClass: string;
  uiChipClass: string;
  uiModalBorderClass: string;
};

const MAX_MEMBERS = 5;
const SRM_EMAIL_DOMAIN = "@srmist.edu.in";
const SRM_DEPARTMENT_DATALIST_ID = "srm-major-departments-dashboard";
const TEAM_TICKET_THEME_STORAGE_KEY = "foundathon:ticket-theme";
const TEAM_TICKET_THEMES: ReadonlyArray<TeamTicketTheme> = [
  {
    accentGlowColor: "rgba(56, 189, 248, 0.2)",
    backdropStops: ["#082f49", "#1d4ed8", "#ea580c"],
    cardStops: ["#fff7ed", "#ffffff", "#eff6ff"],
    cardStrokeColor: "rgba(15, 23, 42, 0.2)",
    description: "Command split style with a dedicated right-side scan bay.",
    headingColor: "#0f172a",
    id: "neon-royale",
    issuedTextColor: "rgba(15, 23, 42, 0.7)",
    label: "Neon Royale",
    layout: "command-split",
    metaLabelColor: "rgba(15, 23, 42, 0.65)",
    noiseDotColor: "#ffffff",
    punchColor: "#1d4ed8",
    qrFrameFillColor: "#f8fafc",
    qrHintColor: "rgba(15, 23, 42, 0.68)",
    qrPanelFillColor: "#ffffff",
    qrPanelStrokeColor: "rgba(59, 130, 246, 0.35)",
    qrTitleColor: "#1e3a8a",
    splitStrokeColor: "rgba(30, 64, 175, 0.35)",
    statementTextColor: "#1f2937",
    statusBgColor: "#dcfce7",
    statusTextColor: "#166534",
    swatchClass: "from-fnblue via-fnorange to-fnred",
    teamIdTextColor: "#0f172a",
    teamTextColor: "#111827",
    titleColor: "#1d4ed8",
    uiAccentTextClass: "text-fnblue",
    uiChipClass: "border-fnblue/35 bg-fnblue/10 text-fnblue",
    uiModalBorderClass: "border-fnblue",
  },
  {
    accentGlowColor: "rgba(251, 146, 60, 0.25)",
    backdropStops: ["#450a0a", "#b91c1c", "#ea580c"],
    cardStops: ["#fff1f2", "#fff7ed", "#fef2f2"],
    cardStrokeColor: "rgba(69, 10, 10, 0.24)",
    description: "Poster stack style with a hero header and stacked blocks.",
    headingColor: "#450a0a",
    id: "crimson-heat",
    issuedTextColor: "rgba(69, 10, 10, 0.72)",
    label: "Crimson Heat",
    layout: "poster-stack",
    metaLabelColor: "rgba(69, 10, 10, 0.68)",
    noiseDotColor: "#ffffff",
    punchColor: "#b91c1c",
    qrFrameFillColor: "#fff7ed",
    qrHintColor: "rgba(69, 10, 10, 0.72)",
    qrPanelFillColor: "#fffaf7",
    qrPanelStrokeColor: "rgba(185, 28, 28, 0.35)",
    qrTitleColor: "#991b1b",
    splitStrokeColor: "rgba(185, 28, 28, 0.32)",
    statementTextColor: "#7f1d1d",
    statusBgColor: "#fee2e2",
    statusTextColor: "#991b1b",
    swatchClass: "from-fnred via-fnorange to-fnyellow",
    teamIdTextColor: "#7f1d1d",
    teamTextColor: "#450a0a",
    titleColor: "#b91c1c",
    uiAccentTextClass: "text-fnred",
    uiChipClass: "border-fnred/35 bg-fnred/10 text-fnred",
    uiModalBorderClass: "border-fnred",
  },
  {
    accentGlowColor: "rgba(20, 184, 166, 0.24)",
    backdropStops: ["#052e2b", "#0f766e", "#155e75"],
    cardStops: ["#ecfeff", "#f0fdfa", "#eef2ff"],
    cardStrokeColor: "rgba(8, 47, 73, 0.24)",
    description: "Ops grid style with modular cards and dashboard rails.",
    headingColor: "#083344",
    id: "aurora-mint",
    issuedTextColor: "rgba(8, 47, 73, 0.72)",
    label: "Aurora Mint",
    layout: "ops-grid",
    metaLabelColor: "rgba(8, 47, 73, 0.68)",
    noiseDotColor: "#ecfeff",
    punchColor: "#0f766e",
    qrFrameFillColor: "#f0fdfa",
    qrHintColor: "rgba(8, 47, 73, 0.7)",
    qrPanelFillColor: "#f8fffe",
    qrPanelStrokeColor: "rgba(15, 118, 110, 0.35)",
    qrTitleColor: "#115e59",
    splitStrokeColor: "rgba(20, 83, 45, 0.28)",
    statementTextColor: "#0f766e",
    statusBgColor: "#dcfce7",
    statusTextColor: "#166534",
    swatchClass: "from-fngreen via-fnblue to-cyan-400",
    teamIdTextColor: "#0f766e",
    teamTextColor: "#083344",
    titleColor: "#0f766e",
    uiAccentTextClass: "text-fngreen",
    uiChipClass: "border-fngreen/35 bg-fngreen/10 text-fngreen",
    uiModalBorderClass: "border-fngreen",
  },
  {
    accentGlowColor: "rgba(220, 38, 38, 0.22)",
    backdropStops: ["#0f5132", "#15803d", "#dc2626"],
    cardStops: ["#fffdf2", "#fff8dd", "#f9f2d4"],
    cardStrokeColor: "rgba(15, 81, 50, 0.32)",
    description:
      "Boardwalk pass style inspired by Monopoly property-card layouts.",
    headingColor: "#1f2937",
    id: "monopoly-classic",
    issuedTextColor: "rgba(31, 41, 55, 0.74)",
    label: "Monopoly Classic",
    layout: "boardwalk-pass",
    metaLabelColor: "rgba(31, 41, 55, 0.62)",
    noiseDotColor: "#fff8dd",
    punchColor: "#dc2626",
    qrFrameFillColor: "#fffced",
    qrHintColor: "rgba(31, 41, 55, 0.72)",
    qrPanelFillColor: "#fffdf4",
    qrPanelStrokeColor: "rgba(21, 128, 61, 0.36)",
    qrTitleColor: "#166534",
    splitStrokeColor: "rgba(21, 128, 61, 0.28)",
    statementTextColor: "#14532d",
    statusBgColor: "#dcfce7",
    statusTextColor: "#166534",
    swatchClass: "from-[#0f7a36] via-[#dc2626] to-[#facc15]",
    teamIdTextColor: "#1f2937",
    teamTextColor: "#111827",
    titleColor: "#dc2626",
    uiAccentTextClass: "text-[#0f7a36]",
    uiChipClass: "border-[#0f7a36]/45 bg-[#0f7a36]/10 text-[#0f7a36]",
    uiModalBorderClass: "border-[#0f7a36]",
  },
] as const;

const isTeamTicketThemeId = (value: string): value is TeamTicketThemeId =>
  TEAM_TICKET_THEMES.some((theme) => theme.id === value);

const getTeamTicketTheme = (themeId: TeamTicketThemeId): TeamTicketTheme =>
  TEAM_TICKET_THEMES.find((theme) => theme.id === themeId) ??
  TEAM_TICKET_THEMES[0];
const TAB_PANEL_TRANSITION = {
  ...MOTION_TRANSITIONS.base,
  ease: MOTION_TRANSITIONS.xl.ease,
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

type TicketLayoutRenderInput = {
  ctx: CanvasRenderingContext2D;
  height: number;
  issuedLine: string;
  qrImage: HTMLImageElement;
  statementLine: string;
  teamId: string;
  teamNameLine: string;
  theme: TeamTicketTheme;
  width: number;
};

type TicketStatusPillInput = {
  bgColor: string;
  ctx: CanvasRenderingContext2D;
  height: number;
  text: string;
  textColor: string;
  width: number;
  x: number;
  y: number;
};

type TicketQrPanelInput = {
  ctx: CanvasRenderingContext2D;
  height: number;
  hint: string;
  qrImage: HTMLImageElement;
  theme: TeamTicketTheme;
  title: string;
  width: number;
  x: number;
  y: number;
};

type TicketFittedTextInput = {
  color: string;
  ctx: CanvasRenderingContext2D;
  family: string;
  maxFontSize: number;
  maxWidth: number;
  minFontSize: number;
  text: string;
  weight: number;
  x: number;
  y: number;
};

const drawFittedTicketText = ({
  color,
  ctx,
  family,
  maxFontSize,
  maxWidth,
  minFontSize,
  text,
  weight,
  x,
  y,
}: TicketFittedTextInput) => {
  let fontSize = maxFontSize;
  while (fontSize > minFontSize) {
    ctx.font = `${weight} ${fontSize}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) {
      break;
    }
    fontSize -= 1;
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, maxWidth);
};

const drawTicketBackdrop = ({
  ctx,
  height,
  theme,
  width,
}: {
  ctx: CanvasRenderingContext2D;
  height: number;
  theme: TeamTicketTheme;
  width: number;
}) => {
  const backdropGradient = ctx.createLinearGradient(0, 0, width, height);
  backdropGradient.addColorStop(0, theme.backdropStops[0]);
  backdropGradient.addColorStop(0.56, theme.backdropStops[1]);
  backdropGradient.addColorStop(1, theme.backdropStops[2]);
  ctx.fillStyle = backdropGradient;
  ctx.fillRect(0, 0, width, height);

  const glowGradient = ctx.createRadialGradient(
    width * 0.78,
    height * 0.16,
    30,
    width * 0.78,
    height * 0.16,
    360,
  );
  glowGradient.addColorStop(0, theme.accentGlowColor);
  glowGradient.addColorStop(1, "transparent");
  ctx.fillStyle = glowGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.14;
  ctx.fillStyle = theme.noiseDotColor;
  for (let i = 0; i < 12; i += 1) {
    const size = 18 + ((i % 4) + 1) * 6;
    const x = 70 + i * 92;
    const y = 48 + (i % 3) * 28;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.strokeStyle = theme.noiseDotColor;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i += 1) {
    const offset = -190 + i * 190;
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 260, height);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
};

const drawTicketStatusPill = ({
  bgColor,
  ctx,
  height,
  text,
  textColor,
  width,
  x,
  y,
}: TicketStatusPillInput) => {
  drawRoundedRect(ctx, x, y, width, height, 14);
  ctx.fillStyle = bgColor;
  ctx.fill();

  ctx.fillStyle = textColor;
  let fontSize = 20;
  while (fontSize > 12) {
    ctx.font = `700 ${fontSize}px 'Helvetica Neue', Arial, sans-serif`;
    if (ctx.measureText(text).width <= width - 24) {
      break;
    }
    fontSize -= 1;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + width / 2, y + height / 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
};

const drawTicketQrPanel = ({
  ctx,
  height,
  hint,
  qrImage,
  theme,
  title,
  width,
  x,
  y,
}: TicketQrPanelInput) => {
  drawRoundedRect(ctx, x, y, width, height, 20);
  ctx.fillStyle = theme.qrPanelFillColor;
  ctx.fill();
  ctx.strokeStyle = theme.qrPanelStrokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = theme.qrTitleColor;
  ctx.font = "800 20px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(title, x + 24, y + 40, width - 48);

  const verticalPadding = 24;
  const contentTop = y + 58;
  const contentBottom = y + height - 48;
  const availableHeight = contentBottom - contentTop;
  const qrSize = Math.max(
    136,
    Math.min(width - verticalPadding * 2, availableHeight - 18, 236),
  );
  const qrX = x + (width - qrSize) / 2;
  const qrY = contentTop + (availableHeight - qrSize) / 2;

  drawRoundedRect(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 14);
  ctx.fillStyle = theme.qrFrameFillColor;
  ctx.fill();
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = theme.qrHintColor;
  ctx.font = "700 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(hint, x + 24, y + height - 20, width - 48);
};

const drawCommandSplitLayout = ({
  ctx,
  height,
  issuedLine,
  qrImage,
  statementLine,
  teamId,
  teamNameLine,
  theme,
  width,
}: TicketLayoutRenderInput) => {
  const cardX = 44;
  const cardY = 38;
  const cardWidth = width - 88;
  const cardHeight = height - 76;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 30);
  const cardGradient = ctx.createLinearGradient(
    cardX,
    cardY,
    cardX + cardWidth,
    cardY + cardHeight,
  );
  cardGradient.addColorStop(0, theme.cardStops[0]);
  cardGradient.addColorStop(0.45, theme.cardStops[1]);
  cardGradient.addColorStop(1, theme.cardStops[2]);
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.cardStrokeColor;
  ctx.stroke();

  const headerX = cardX + 24;
  const headerY = cardY + 20;
  const headerWidth = cardWidth - 48;
  drawRoundedRect(ctx, headerX, headerY, headerWidth, 56, 14);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = theme.punchColor;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = theme.titleColor;
  ctx.font = "800 18px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FOUNDATHON // DASHBOARD PASS", headerX + 18, headerY + 35);

  ctx.fillStyle = theme.issuedTextColor;
  ctx.font = "700 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    "foundathon.thefoundersclub.tech/dashboard",
    headerX + headerWidth - 300,
    headerY + 35,
  );

  const splitX = Math.round(cardX + cardWidth * 0.645);
  ctx.save();
  ctx.setLineDash([9, 9]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.beginPath();
  ctx.moveTo(splitX, cardY + 98);
  ctx.lineTo(splitX, cardY + cardHeight - 32);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = theme.punchColor;
  ctx.beginPath();
  ctx.arc(splitX, cardY, 18, 0, Math.PI, true);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(splitX, cardY + cardHeight, 18, Math.PI, 0, true);
  ctx.fill();

  const leftX = cardX + 50;
  const leftWidth = splitX - leftX - 30;
  drawFittedTicketText({
    color: theme.headingColor,
    ctx,
    family: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
    maxFontSize: 48,
    maxWidth: leftWidth,
    minFontSize: 34,
    text: "TEAM ACCESS PASS",
    weight: 800,
    x: leftX,
    y: cardY + 136,
  });

  drawTicketStatusPill({
    bgColor: theme.statusBgColor,
    ctx,
    height: 44,
    text: "STATUS: ACCEPTED",
    textColor: theme.statusTextColor,
    width: 292,
    x: leftX,
    y: cardY + 158,
  });

  const drawMetaCard = ({
    label,
    value,
    valueColor,
    valueFont,
    y,
  }: {
    label: string;
    value: string;
    valueColor: string;
    valueFont: string;
    y: number;
  }) => {
    drawRoundedRect(ctx, leftX, y, leftWidth, 86, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
    ctx.fill();
    ctx.strokeStyle = theme.splitStrokeColor;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.fillStyle = theme.metaLabelColor;
    ctx.font = "700 15px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(label, leftX + 16, y + 28);

    ctx.fillStyle = valueColor;
    ctx.font = valueFont;
    ctx.fillText(value, leftX + 16, y + 62, leftWidth - 32);
  };

  const metaStartY = cardY + 214;
  drawMetaCard({
    label: "TEAM NAME",
    value: teamNameLine,
    valueColor: theme.teamTextColor,
    valueFont: "800 33px 'Helvetica Neue', Arial, sans-serif",
    y: metaStartY,
  });
  drawMetaCard({
    label: "TEAM ID",
    value: teamId,
    valueColor: theme.teamIdTextColor,
    valueFont: "700 24px 'SFMono-Regular', Menlo, Consolas, monospace",
    y: metaStartY + 98,
  });
  drawMetaCard({
    label: "LOCKED TRACK",
    value: statementLine,
    valueColor: theme.statementTextColor,
    valueFont: "700 24px 'Helvetica Neue', Arial, sans-serif",
    y: metaStartY + 196,
  });

  drawRoundedRect(ctx, leftX, cardY + cardHeight - 70, leftWidth, 38, 10);
  ctx.fillStyle = theme.qrFrameFillColor;
  ctx.fill();
  ctx.strokeStyle = theme.qrPanelStrokeColor;
  ctx.stroke();
  ctx.fillStyle = theme.issuedTextColor;
  ctx.font = "700 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    "Carry this pass with your college ID for on-ground check-in.",
    leftX + 14,
    cardY + cardHeight - 45,
  );

  const qrPanelX = splitX + 24;
  drawTicketQrPanel({
    ctx,
    height: cardHeight - 138,
    hint: "Scan this code at entry desk for fast verification.",
    qrImage,
    theme,
    title: "SCAN TO VERIFY ENTRY",
    width: cardX + cardWidth - qrPanelX - 24,
    x: qrPanelX,
    y: cardY + 96,
  });

  ctx.fillStyle = theme.issuedTextColor;
  ctx.font = "600 14px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(issuedLine, leftX, cardY + cardHeight - 88);
};

const drawPosterStackLayout = ({
  ctx,
  height,
  issuedLine,
  qrImage,
  statementLine,
  teamId,
  teamNameLine,
  theme,
  width,
}: TicketLayoutRenderInput) => {
  const cardX = 50;
  const cardY = 42;
  const cardWidth = width - 100;
  const cardHeight = height - 84;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 28);
  const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
  cardGradient.addColorStop(0, theme.cardStops[0]);
  cardGradient.addColorStop(0.36, theme.cardStops[1]);
  cardGradient.addColorStop(1, theme.cardStops[2]);
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.cardStrokeColor;
  ctx.stroke();

  const heroX = cardX + 22;
  const heroY = cardY + 20;
  const heroWidth = cardWidth - 44;
  drawRoundedRect(ctx, heroX, heroY, heroWidth, 98, 18);
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = theme.punchColor;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = theme.titleColor;
  ctx.font = "900 24px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FOUNDATHON 3.0", heroX + 18, heroY + 38);
  ctx.fillStyle = theme.headingColor;
  ctx.font = "800 26px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("ACCEPTED TEAM TICKET", heroX + 18, heroY + 76);

  drawTicketStatusPill({
    bgColor: theme.statusBgColor,
    ctx,
    height: 40,
    text: "ACCEPTED",
    textColor: theme.statusTextColor,
    width: 258,
    x: heroX + heroWidth - 278,
    y: heroY + 29,
  });

  drawFittedTicketText({
    color: theme.teamTextColor,
    ctx,
    family: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
    maxFontSize: 56,
    maxWidth: cardWidth - 72,
    minFontSize: 36,
    text: teamNameLine,
    weight: 800,
    x: cardX + 34,
    y: cardY + 188,
  });

  ctx.fillStyle = theme.metaLabelColor;
  ctx.font = "700 18px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(`LOCKED TRACK: ${statementLine}`, cardX + 34, cardY + 222, cardWidth - 68);

  const infoX = cardX + 28;
  const infoY = cardY + 242;
  const infoWidth = cardWidth - 56;
  const infoHeight = 94;
  drawRoundedRect(ctx, infoX, infoY, infoWidth, infoHeight, 14);
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.fill();
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const splitOne = infoX + Math.round(infoWidth * 0.38);
  const splitTwo = infoX + Math.round(infoWidth * 0.67);
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.beginPath();
  ctx.moveTo(splitOne, infoY + 12);
  ctx.lineTo(splitOne, infoY + infoHeight - 12);
  ctx.moveTo(splitTwo, infoY + 12);
  ctx.lineTo(splitTwo, infoY + infoHeight - 12);
  ctx.stroke();

  ctx.fillStyle = theme.metaLabelColor;
  ctx.font = "700 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("TEAM ID", infoX + 16, infoY + 28);
  ctx.fillText("ISSUED", splitOne + 16, infoY + 28);
  ctx.fillText("CHECK-IN", splitTwo + 16, infoY + 28);

  ctx.fillStyle = theme.teamIdTextColor;
  ctx.font = "700 22px 'SFMono-Regular', Menlo, Consolas, monospace";
  ctx.fillText(teamId, infoX + 16, infoY + 64, splitOne - infoX - 26);
  ctx.fillStyle = theme.issuedTextColor;
  ctx.font = "700 15px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(issuedLine, splitOne + 16, infoY + 64, splitTwo - splitOne - 24);
  ctx.fillStyle = theme.qrHintColor;
  ctx.font = "700 15px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    "Show this pass at gate",
    splitTwo + 16,
    infoY + 64,
    infoX + infoWidth - splitTwo - 20,
  );

  const bottomY = cardY + 358;
  const bottomHeight = cardY + cardHeight - bottomY - 28;
  drawTicketQrPanel({
    ctx,
    height: bottomHeight,
    hint: "Scan once at registration desk for final check-in.",
    qrImage,
    theme,
    title: "QR CHECK-IN",
    width: 422,
    x: cardX + 30,
    y: bottomY,
  });

  const rightPanelX = cardX + 470;
  const rightPanelWidth = cardX + cardWidth - rightPanelX - 30;
  drawRoundedRect(ctx, rightPanelX, bottomY, rightPanelWidth, bottomHeight, 20);
  ctx.fillStyle = "rgba(255, 255, 255, 0.64)";
  ctx.fill();
  ctx.strokeStyle = theme.qrPanelStrokeColor;
  ctx.stroke();

  ctx.fillStyle = theme.headingColor;
  ctx.font = "800 23px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("ENTRY CHECKLIST", rightPanelX + 20, bottomY + 40);

  ctx.fillStyle = theme.statementTextColor;
  ctx.font = "700 17px 'Helvetica Neue', Arial, sans-serif";
  const checklist = [
    "- Keep this ticket open or downloaded.",
    "- Bring college ID for identity match.",
    "- Team lead should check in first.",
    "- Follow your assigned track queue.",
  ];
  checklist.forEach((line, index) => {
    ctx.fillText(line, rightPanelX + 20, bottomY + 82 + index * 40, rightPanelWidth - 40);
  });
};

const drawOpsGridLayout = ({
  ctx,
  height,
  issuedLine,
  qrImage,
  statementLine,
  teamId,
  teamNameLine,
  theme,
  width,
}: TicketLayoutRenderInput) => {
  const cardX = 50;
  const cardY = 44;
  const cardWidth = width - 100;
  const cardHeight = height - 88;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 24);
  const cardGradient = ctx.createLinearGradient(
    cardX,
    cardY,
    cardX + cardWidth,
    cardY + cardHeight,
  );
  cardGradient.addColorStop(0, theme.cardStops[0]);
  cardGradient.addColorStop(0.5, theme.cardStops[1]);
  cardGradient.addColorStop(1, theme.cardStops[2]);
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.cardStrokeColor;
  ctx.stroke();

  ctx.save();
  drawRoundedRect(ctx, cardX + 4, cardY + 4, cardWidth - 8, cardHeight - 8, 20);
  ctx.clip();
  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.lineWidth = 1;
  for (let x = cardX + 18; x < cardX + cardWidth - 16; x += 42) {
    ctx.beginPath();
    ctx.moveTo(x, cardY + 8);
    ctx.lineTo(x, cardY + cardHeight - 8);
    ctx.stroke();
  }
  for (let y = cardY + 18; y < cardY + cardHeight - 16; y += 36) {
    ctx.beginPath();
    ctx.moveTo(cardX + 8, y);
    ctx.lineTo(cardX + cardWidth - 8, y);
    ctx.stroke();
  }
  ctx.restore();

  drawRoundedRect(ctx, cardX + 26, cardY + 22, 340, 44, 12);
  ctx.fillStyle = theme.qrFrameFillColor;
  ctx.fill();
  ctx.strokeStyle = theme.qrPanelStrokeColor;
  ctx.stroke();
  ctx.fillStyle = theme.titleColor;
  ctx.font = "800 17px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FOUNDATHON OPS BOARD", cardX + 42, cardY + 50);

  drawRoundedRect(ctx, cardX + cardWidth - 308, cardY + 22, 282, 44, 12);
  ctx.fillStyle = theme.qrFrameFillColor;
  ctx.fill();
  ctx.strokeStyle = theme.qrPanelStrokeColor;
  ctx.stroke();
  ctx.fillStyle = theme.teamIdTextColor;
  ctx.font = "700 18px 'SFMono-Regular', Menlo, Consolas, monospace";
  ctx.fillText(teamId, cardX + cardWidth - 292, cardY + 50, 260);

  drawTicketStatusPill({
    bgColor: theme.statusBgColor,
    ctx,
    height: 42,
    text: "STATUS: ACCEPTED",
    textColor: theme.statusTextColor,
    width: 248,
    x: cardX + cardWidth - 274,
    y: cardY + 82,
  });

  drawTicketQrPanel({
    ctx,
    height: 378,
    hint: "Primary check-in QR. Keep this ticket ready.",
    qrImage,
    theme,
    title: "SCAN NODE",
    width: 360,
    x: cardX + 34,
    y: cardY + 142,
  });

  const rightX = cardX + 420;
  const rightWidth = cardX + cardWidth - rightX - 26;
  const drawDataPanel = ({
    label,
    value,
    valueColor,
    valueFont,
    y,
  }: {
    label: string;
    value: string;
    valueColor: string;
    valueFont: string;
    y: number;
  }) => {
    drawRoundedRect(ctx, rightX, y, rightWidth, 112, 14);
    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    ctx.fill();
    ctx.strokeStyle = theme.qrPanelStrokeColor;
    ctx.stroke();

    ctx.fillStyle = theme.metaLabelColor;
    ctx.font = "700 14px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(label, rightX + 16, y + 30);
    ctx.fillStyle = valueColor;
    ctx.font = valueFont;
    ctx.fillText(value, rightX + 16, y + 74, rightWidth - 32);
  };

  drawDataPanel({
    label: "TEAM",
    value: teamNameLine,
    valueColor: theme.teamTextColor,
    valueFont: "800 34px 'Helvetica Neue', Arial, sans-serif",
    y: cardY + 142,
  });
  drawDataPanel({
    label: "LOCKED TRACK",
    value: statementLine,
    valueColor: theme.statementTextColor,
    valueFont: "700 25px 'Helvetica Neue', Arial, sans-serif",
    y: cardY + 270,
  });
  drawDataPanel({
    label: "ISSUE LOG",
    value: issuedLine,
    valueColor: theme.issuedTextColor,
    valueFont: "700 18px 'Helvetica Neue', Arial, sans-serif",
    y: cardY + 398,
  });

  drawRoundedRect(ctx, rightX, cardY + cardHeight - 56, rightWidth, 30, 10);
  ctx.fillStyle = theme.qrFrameFillColor;
  ctx.fill();
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.stroke();
  ctx.fillStyle = theme.qrHintColor;
  ctx.font = "700 12px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(
    "VALID FOR ON-GROUND CHECK-IN ONLY",
    rightX + 14,
    cardY + cardHeight - 37,
  );
};

const drawBoardwalkPassLayout = ({
  ctx,
  height,
  issuedLine,
  qrImage,
  statementLine,
  teamId,
  teamNameLine,
  theme,
  width,
}: TicketLayoutRenderInput) => {
  const cardX = 56;
  const cardY = 44;
  const cardWidth = width - 112;
  const cardHeight = height - 88;
  drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 22);
  const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
  cardGradient.addColorStop(0, theme.cardStops[0]);
  cardGradient.addColorStop(0.5, theme.cardStops[1]);
  cardGradient.addColorStop(1, theme.cardStops[2]);
  ctx.fillStyle = cardGradient;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = theme.cardStrokeColor;
  ctx.stroke();

  drawRoundedRect(ctx, cardX + 12, cardY + 12, cardWidth - 24, cardHeight - 24, 16);
  ctx.lineWidth = 2;
  ctx.strokeStyle = theme.splitStrokeColor;
  ctx.stroke();

  drawRoundedRect(ctx, cardX + 22, cardY + 20, cardWidth - 44, 68, 12);
  ctx.fillStyle = "#dc2626";
  ctx.fill();
  ctx.fillStyle = "#fffdf2";
  ctx.font = "900 26px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText("FOUNDATHON BOARDWALK PASS", cardX + 44, cardY + 63);

  const railX = cardX + 28;
  const railY = cardY + 110;
  const railWidth = 144;
  const railHeight = cardHeight - 190;
  drawRoundedRect(ctx, railX, railY, railWidth, railHeight, 12);
  ctx.fillStyle = "#fef3c7";
  ctx.fill();
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const propertyColors = ["#16a34a", "#dc2626", "#2563eb", "#f59e0b"];
  propertyColors.forEach((color, index) => {
    const blockY = railY + 14 + index * 68;
    drawRoundedRect(ctx, railX + 12, blockY, railWidth - 24, 52, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#fffef9";
    ctx.font = "800 11px 'Arial Black', 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(`ZONE ${index + 1}`, railX + 24, blockY + 31);
  });

  const qrPanelWidth = 292;
  const qrPanelX = cardX + cardWidth - qrPanelWidth - 28;
  drawTicketQrPanel({
    ctx,
    height: cardHeight - 204,
    hint: "Scan this title-deed QR at the registration counter.",
    qrImage,
    theme,
    title: "TITLE DEED QR",
    width: qrPanelWidth,
    x: qrPanelX,
    y: cardY + 110,
  });

  const centerX = railX + railWidth + 20;
  const centerWidth = qrPanelX - centerX - 18;
  drawFittedTicketText({
    color: theme.headingColor,
    ctx,
    family: "'Arial Black', 'Helvetica Neue', Arial, sans-serif",
    maxFontSize: 46,
    maxWidth: centerWidth,
    minFontSize: 28,
    text: "TEAM ACCESS TITLE",
    weight: 800,
    x: centerX,
    y: cardY + 156,
  });

  drawTicketStatusPill({
    bgColor: theme.statusBgColor,
    ctx,
    height: 44,
    text: "STATUS: ACCEPTED",
    textColor: theme.statusTextColor,
    width: Math.min(286, centerWidth),
    x: centerX,
    y: cardY + 176,
  });

  const drawCenterCard = ({
    label,
    value,
    valueColor,
    valueFont,
    y,
  }: {
    label: string;
    value: string;
    valueColor: string;
    valueFont: string;
    y: number;
  }) => {
    drawRoundedRect(ctx, centerX, y, centerWidth, 88, 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fill();
    ctx.strokeStyle = theme.qrPanelStrokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = theme.metaLabelColor;
    ctx.font = "700 14px 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(label, centerX + 14, y + 28);
    ctx.fillStyle = valueColor;
    ctx.font = valueFont;
    ctx.fillText(value, centerX + 14, y + 62, centerWidth - 24);
  };

  drawCenterCard({
    label: "TEAM NAME",
    value: teamNameLine,
    valueColor: theme.teamTextColor,
    valueFont: "800 30px 'Helvetica Neue', Arial, sans-serif",
    y: cardY + 238,
  });
  drawCenterCard({
    label: "TEAM ID",
    value: teamId,
    valueColor: theme.teamIdTextColor,
    valueFont: "700 23px 'SFMono-Regular', Menlo, Consolas, monospace",
    y: cardY + 338,
  });
  drawCenterCard({
    label: "TRACK",
    value: statementLine,
    valueColor: theme.statementTextColor,
    valueFont: "700 22px 'Helvetica Neue', Arial, sans-serif",
    y: cardY + 438,
  });

  drawRoundedRect(ctx, centerX, cardY + cardHeight - 66, centerWidth, 34, 8);
  ctx.fillStyle = "#166534";
  ctx.fill();
  ctx.fillStyle = "#ecfdf5";
  ctx.font = "700 13px 'Helvetica Neue', Arial, sans-serif";
  ctx.fillText(issuedLine, centerX + 12, cardY + cardHeight - 44, centerWidth - 24);
};

const buildAcceptedTeamTicketDataUrl = async ({
  qrDataUrl,
  statementTitle,
  teamId,
  teamName,
  themeId,
}: {
  qrDataUrl: string;
  statementTitle: string;
  teamId: string;
  teamName: string;
  themeId: TeamTicketThemeId;
}) => {
  if (typeof document === "undefined") {
    throw new Error("Document is unavailable.");
  }

  const theme = getTeamTicketTheme(themeId);

  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 675;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context is unavailable.");
  }

  const qrImage = await loadCanvasImage(qrDataUrl);
  const issuedLine = `Issued: ${new Date().toLocaleString()}`;
  const layoutInput: TicketLayoutRenderInput = {
    ctx,
    height,
    issuedLine,
    qrImage,
    statementLine: toTicketLine(statementTitle, 50),
    teamId,
    teamNameLine: toTicketLine(teamName, 30),
    theme,
    width,
  };

  drawTicketBackdrop({ ctx, height, theme, width });

  switch (theme.layout) {
    case "poster-stack":
      drawPosterStackLayout(layoutInput);
      break;
    case "ops-grid":
      drawOpsGridLayout(layoutInput);
      break;
    case "boardwalk-pass":
      drawBoardwalkPassLayout(layoutInput);
      break;
    default:
      drawCommandSplitLayout(layoutInput);
      break;
  }

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
          "Your team has been approved by admins. You may download your ticket from the QR icon.",
        dotClass: "bg-fngreen",
        label: "Accepted",
        panelClass:
          "border-fngreen bg-linear-to-r from-fngreen/15 via-background to-fngreen/5",
      };
    case "rejected":
      return {
        badgeClass: "border-fnred/40 bg-fnred/10 text-fnred",
        description:
          "We appreciate the time and effort you put into your submission. After careful consideration, it was not selected.",
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
          "Team is created but no PPT is submitted yet. Submit your presentation from PPT Submission to move to review.",
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
  const { resolved } = useMotionPreferences();
  const { start: startRouteProgress } = useRouteProgress();
  const isReducedMotion = resolved === "reduced";
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
  const [teamTicketThemeId, setTeamTicketThemeId] =
    useState<TeamTicketThemeId>("monopoly-classic");
  const [teamTicketPreviewThemeId, setTeamTicketPreviewThemeId] =
    useState<TeamTicketThemeId | null>(null);
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
  const selectedTeamTicketTheme = useMemo(
    () => getTeamTicketTheme(teamTicketThemeId),
    [teamTicketThemeId],
  );
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
  const normalizedDeleteConfirmationInput = normalizeConfirmationText(
    deleteConfirmationInput,
  );
  const normalizedDeleteConfirmationPhrase = normalizeConfirmationText(
    deleteConfirmationPhrase,
  );
  const normalizedQuotedDeleteConfirmationPhrase = normalizeConfirmationText(
    `"${deleteConfirmationPhrase}"`,
  );
  const normalizedLegacyLockConfirmationInput = normalizeConfirmationText(
    legacyLockConfirmationInput,
  );
  const normalizedLegacyLockConfirmationPhrase = normalizeConfirmationText(
    legacyLockConfirmationPhrase,
  );
  const normalizedQuotedLegacyLockConfirmationPhrase = normalizeConfirmationText(
    `"${legacyLockConfirmationPhrase}"`,
  );
  const canConfirmDelete =
    normalizedDeleteConfirmationInput === normalizedDeleteConfirmationPhrase ||
    normalizedDeleteConfirmationInput === normalizedQuotedDeleteConfirmationPhrase;
  const canConfirmLegacyLock =
    Boolean(pendingLockProblemStatement) &&
    (normalizedLegacyLockConfirmationInput ===
      normalizedLegacyLockConfirmationPhrase ||
      normalizedLegacyLockConfirmationInput ===
        normalizedQuotedLegacyLockConfirmationPhrase);
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
    if (typeof window === "undefined") {
      return;
    }

    const storedTheme = window.localStorage.getItem(
      TEAM_TICKET_THEME_STORAGE_KEY,
    );
    if (storedTheme && isTeamTicketThemeId(storedTheme)) {
      setTeamTicketThemeId(storedTheme);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(TEAM_TICKET_THEME_STORAGE_KEY, teamTicketThemeId);
  }, [teamTicketThemeId]);

  useEffect(() => {
    let cancelled = false;

    if (!shouldShowAcceptedQr || !teamId) {
      setTeamIdQrDataUrl("");
      setIsGeneratingTeamQr(false);
      setTeamQrGenerationError(false);
      setShowTeamTicketModal(false);
      setTeamTicketPreviewDataUrl("");
      setTeamTicketPreviewThemeId(null);
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
      setTeamTicketPreviewThemeId(null);
      setIsGeneratingTeamTicketPreview(false);
      setTeamTicketPreviewError(false);
      return;
    }

    setIsGeneratingTeamTicketPreview(true);
    setTeamTicketPreviewError(false);
    setTeamTicketPreviewThemeId(null);

    void buildAcceptedTeamTicketDataUrl({
      qrDataUrl: teamIdQrDataUrl,
      statementTitle: problemStatement.title || "No track selected",
      teamId,
      teamName: teamName || "Unnamed Team",
      themeId: teamTicketThemeId,
    })
      .then((dataUrl) => {
        if (cancelled) {
          return;
        }

        setTeamTicketPreviewDataUrl(dataUrl);
        setTeamTicketPreviewThemeId(teamTicketThemeId);
        setTeamTicketPreviewError(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setTeamTicketPreviewDataUrl("");
        setTeamTicketPreviewThemeId(null);
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
    teamTicketThemeId,
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
        (teamTicketPreviewThemeId === teamTicketThemeId
          ? teamTicketPreviewDataUrl
          : "") ||
        (await buildAcceptedTeamTicketDataUrl({
          qrDataUrl: teamIdQrDataUrl,
          statementTitle: problemStatement.title || "No track selected",
          teamId,
          teamName: teamName || "Unnamed Team",
          themeId: teamTicketThemeId,
        }));

      if (typeof document === "undefined") {
        throw new Error("Document unavailable");
      }

      const anchor = document.createElement("a");
      anchor.href = ticketDataUrl;
      anchor.download = `foundathon-ticket-${teamId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${teamTicketThemeId}.png`;
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
      `Style: ${selectedTeamTicketTheme.label}`,
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
          (teamTicketPreviewThemeId === teamTicketThemeId
            ? teamTicketPreviewDataUrl
            : "") ||
          (await buildAcceptedTeamTicketDataUrl({
            qrDataUrl: teamIdQrDataUrl,
            statementTitle: problemStatement.title || "No track selected",
            teamId,
            teamName: teamName || "Unnamed Team",
            themeId: teamTicketThemeId,
          }));

        const response = await fetch(ticketDataUrl);
        const ticketBlob = await response.blob();
        const ticketFile = new File(
          [ticketBlob],
          `foundathon-ticket-${teamId.replace(/[^a-zA-Z0-9_-]/g, "-")}-${teamTicketThemeId}.png`,
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
        <div className="absolute inset-0 bg-linear-to-br from-white/14 via-transparent to-fnblue/12 opacity-60 pointer-events-none motion-safe:animate-[ambient-pan_14s_ease-in-out_infinite]" />
        <div className="absolute -top-24 right-0 size-80 rounded-full bg-fnblue/20 blur-3xl pointer-events-none motion-safe:animate-[ambient-orbit_18s_ease-in-out_infinite]" />
        <div className="absolute -bottom-20 -left-12 size-80 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none motion-safe:animate-[ambient-orbit_21s_ease-in-out_infinite]" />

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
      <div className="absolute inset-0 bg-linear-to-br from-white/14 via-transparent to-fnblue/12 opacity-60 pointer-events-none motion-safe:animate-[ambient-pan_14s_ease-in-out_infinite]" />
      <div className="absolute -top-24 right-0 size-96 rounded-full bg-fnblue/20 blur-3xl pointer-events-none motion-safe:animate-[ambient-orbit_18s_ease-in-out_infinite]" />
      <div className="absolute -bottom-28 -left-16 size-96 rounded-full bg-fnyellow/25 blur-3xl pointer-events-none motion-safe:animate-[ambient-orbit_21s_ease-in-out_infinite]" />

      <div className="fncontainer relative py-10 md:py-14">
        <div className="lg:flex items-end justify-between">
          <header className="mb-10">
            <p className="inline-flex rounded-full border-2 border-fnblue bg-fnblue/20 px-3 text-sm font-extrabold tracking-wider uppercase text-fnblue">
              Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl uppercase">
              Team Management Board
            </h1>
            <p className="mt-4 text-sm text-foreground/80 md:text-base font-medium">
              {activeTabMeta.description}
            </p>
          </header>

          {/* <section className="mb-6 rounded-2xl border border-b-4 border-fnblue bg-background/95 p-4 shadow-lg md:p-5 flex flex-col items-center"> */}
          <section className="mb-6 lg:text-right">
            <p className="text-xs font-extrabold uppercase tracking-widest text-fnblue">
              Dashboard Navigation
            </p>
            <div
              className="mt-2 backdrop-blur-md p-1 rounded-2xl border border-fnblue inline-flex"
              role="tablist"
              aria-label="Team dashboard sections"
            >
              <div className="rounded-xl overflow-hidden">
                <div className="flex gap-2 overflow-x-auto flex-wrap sm:flex-nowrap">
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
                        className={`shrink-0 rounded-xl px-4 py-2 text-sm font-extrabold uppercase tracking-wide transition-[transform,background-color,color,box-shadow] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-emphasized)] hover:-translate-y-0.5 ${
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
            </div>
          </section>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {activeTab === "overview" ? (
            <motion.section
              key="dashboard-tab-overview"
              initial={isReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={TAB_PANEL_TRANSITION}
              id="dashboard-panel-overview"
              role="tabpanel"
              aria-labelledby="dashboard-tab-overview"
              className="space-y-6"
            >
              <InView
                once
                viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                transition={{ duration: 0.24, ease: "easeOut", delay: 0.02 }}
                variants={SCROLL_FLOW_VARIANTS}
              >
                <motion.section
                  initial={isReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...TAB_PANEL_TRANSITION, delay: 0.02 }}
                  className={`relative overflow-visible rounded-2xl border border-b-4 p-5 shadow-lg md:p-6 ${teamApprovalStatusMeta.panelClass}`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p
                        className={cn(
                          "text-sm font-extrabold uppercase tracking-wider text-foreground/80",
                          teamApprovalStatusMeta.dotClass.replace("bg", "text"),
                        )}
                      >
                        Team Status
                      </p>
                      <div
                        className={cn(
                          `mt-3 inline-flex items-center gap-2 rounded-full border px-1 text-xs font-bold uppercase tracking-wider ${teamApprovalStatusMeta.badgeClass}`,
                          teamApprovalStatusMeta.dotClass.replace(
                            "bg",
                            "border",
                          ),
                        )}
                      >
                        <span
                          className={`inline-flex size-2 rounded-full animate-pulse ${teamApprovalStatusMeta.dotClass}`}
                        />
                        {teamApprovalStatusMeta.label}
                      </div>
                      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/80 md:text-base font-medium">
                        {teamApprovalStatusMeta.description}
                      </p>
                    </div>

                    <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
                      <div className="flex self-end gap-2">
                        <div className="relative group">
                          <button
                            type="button"
                            aria-label="Status meaning"
                            className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/20 bg-white/80 text-foreground/80 transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45"
                          >
                            <Info size={16} strokeWidth={2.6} />
                          </button>
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute right-0 z-20 -mt-28 w-72 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-xs leading-relaxed text-foreground/80 font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                          >
                            {teamApprovalStatusMeta.label}:{" "}
                            {teamApprovalStatusMeta.description}
                          </div>
                        </div>

                        <div className="relative group">
                          <button
                            type="button"
                            aria-label="Open team ticket"
                            onClick={openTeamTicketModal}
                            disabled={
                              !shouldShowAcceptedQr ||
                              isGeneratingTeamQr ||
                              teamQrGenerationError
                            }
                            className="inline-flex size-8 items-center justify-center rounded-full border border-foreground/20 bg-white/80 text-foreground/80 transition-colors hover:bg-white hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/45 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <QrCode size={16} strokeWidth={2.6} />
                          </button>
                          <div
                            role="tooltip"
                            className="pointer-events-none absolute right-0 z-20 -mt-24 w-72 rounded-lg border border-foreground/15 bg-background px-3 py-2 text-xs leading-relaxed text-foreground/80 font-medium opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                          >
                            {shouldShowAcceptedQr
                              ? "Click the QR icon to open and download your team ticket."
                              : "Team ticket download unlocks once your team is accepted."}
                          </div>
                        </div>
                      </div>

                      {/* {shouldShowAcceptedQr ? (
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
                  ) : null} */}
                    </div>
                  </div>
                </motion.section>
              </InView>

              <InView
                once
                viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                transition={{ duration: 0.24, ease: "easeOut", delay: 0.05 }}
                variants={SCROLL_FLOW_VARIANTS}
              >
                <motion.section
                  initial={isReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...TAB_PANEL_TRANSITION, delay: 0.06 }}
                  className={`relative overflow-hidden rounded-2xl border border-b-4 p-6 md:p-8 shadow-xl ${
                    hasLockedProblemStatement
                      ? "border-fngreen border-b-fnyellow bg-linear-to-b from-fngreen/30 to-fnyellow/10"
                      : "border-fnred border-b-fnorange bg-linear-to-b from-fnred/30 to-fnorange/10"
                  }`}
                >
                  <div className="absolute -top-10 -right-10 size-36 rounded-full bg-fnblue/10 blur-2xl pointer-events-none" />
                  <div className="absolute -bottom-12 -left-12 size-32 rounded-full bg-fnyellow/25 blur-2xl pointer-events-none" />
                  <div className="relative">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p
                        className={`text-xs font-extrabold uppercase tracking-wider ${
                          hasLockedProblemStatement
                            ? "text-fngreen"
                            : "text-fnred"
                        }`}
                      >
                        Your Problem Statement
                      </p>
                      <span
                        className={`rounded-full px-3 border-2 text-xs font-bold uppercase tracking-widest ${
                          problemStatementStatusTone === "green"
                            ? "border-fngreen bg-fngreen/20 text-fngreen"
                            : "border-fnred bg-fnred/20 text-fnred"
                        }`}
                      >
                        {problemStatementStatusLabel}
                      </span>
                    </div>
                    <h2 className="mt-10 text-2xl font-black uppercase tracking-tight md:text-3xl leading-none">
                      {problemStatementTitle}
                    </h2>
                    <p className="mt-1 max-w-3xl text-xs text-foreground/80 font-medium">
                      {hasLockedProblemStatement
                        ? "This is your official track for Foundathon 3.0. Keep your build and pitch aligned to this statement."
                        : "No statement lock is attached to this team record yet. Move to Manage Team to complete your lock and continue."}
                    </p>

                    {/* <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                </div> */}
                  </div>
                </motion.section>
              </InView>

              <InView
                once
                viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                transition={{ duration: 0.24, ease: "easeOut", delay: 0.08 }}
                variants={SCROLL_FLOW_VARIANTS}
              >
                <motion.section
                  initial={isReducedMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...TAB_PANEL_TRANSITION, delay: 0.1 }}
                  className="relative overflow-hidden rounded-2xl border border-b-4 border-fnorange bg-background/95 p-6 shadow-lg"
                >
                  <div className="absolute -top-10 right-0 size-36 rounded-full bg-fnorange/10 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-10 -left-8 size-32 rounded-full bg-fnblue/10 blur-3xl pointer-events-none" />

                  <div className="relative grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className="">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-fnorange">
                        Team Snapshot
                      </p>
                      <h3 className="mt-6 text-2xl font-black uppercase tracking-tight leading-none">
                        Continue Team Operations
                      </h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/80">
                        Manage roster updates from Manage Team and complete
                        one-time PPT operations from PPT Submission.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border-2 border-fnblue bg-fnblue/20 px-3 text-sm font-extrabold uppercase tracking-wide text-fnblue">
                          {teamTypeLabel}
                        </span>
                        <span className="rounded-full border-2 border-fngreen bg-fngreen/20 px-3 text-sm font-extrabold uppercase tracking-wide text-fngreen">
                          {memberCount}/5 Members
                        </span>
                        <span className="rounded-full border-2 border-fnorange bg-fnorange/20 px-3 text-sm font-extrabold uppercase tracking-wide text-fnorange">
                          {completedProfiles}/{memberCount} Complete
                        </span>
                      </div>
                      {/* <div className="mt-4 flex flex-wrap gap-3">
                    <FnButton type="button" onClick={() => goToTab("manage")}>
                      Go to Manage Team
                    </FnButton>
                    <FnButton
                      type="button"
                      tone="yellow"
                      onClick={() => goToTab("actions")}
                    >
                      Go to PPT Submission
                    </FnButton>
                  </div> */}
                    </div>

                    <div className="rounded-xl border border-fnorange/30 bg-white/70 p-4 backdrop-blur-xs">
                      <div className="grid gap-2 text-sm">
                        <MetricRow
                          label="Team Name"
                          value={teamName || "N/A"}
                        />
                        <div className="flex items-center justify-between gap-4 py-1.5 border-b border-foreground/10">
                          <p className="text-sm font-extrabold uppercase text-foreground/80">
                            Team ID
                          </p>
                          <div className="flex items-center gap-2">
                            <p className="font-sans font-medium text-right">
                              {teamId}
                            </p>
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
                            (teamType === "srm"
                              ? leadSrm.name
                              : leadNonSrm.name) || "N/A"
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
                      <p className="text-xs font-extrabold uppercase tracking-widest text-fnorange">
                        Members Snapshot
                      </p>
                      <p className="text-xs font-extrabold uppercase tracking-widest text-foreground/65">
                        Total Members:{" "}
                        <span className="text-fnorange">{memberCount}</span>
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
                              <span className="inline-flex rounded-full border-2 border-fnblue bg-fnblue/20 px-2 text-xs font-extrabold uppercase text-fnblue">
                                Lead
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">
                              {(teamType === "srm"
                                ? leadSrm.name
                                : leadNonSrm.name) || "-"}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {currentLeadId || "-"}
                            </td>
                          </tr>
                          <AnimatePresence initial={false}>
                            {currentMembers.map((member, idx) => (
                              <motion.tr
                                key={`${getCurrentMemberId(member)}-${idx}`}
                                layout={!isReducedMotion}
                                initial={
                                  isReducedMotion
                                    ? false
                                    : { opacity: 0, y: 10, filter: "blur(2px)" }
                                }
                                animate={{
                                  opacity: 1,
                                  y: 0,
                                  filter: "blur(0px)",
                                }}
                                exit={
                                  isReducedMotion
                                    ? undefined
                                    : { opacity: 0, y: -8, filter: "blur(2px)" }
                                }
                                transition={TAB_PANEL_TRANSITION}
                                className="border-b border-foreground/10 hover:bg-fnblue/5 last:border-b-0"
                              >
                                <td className="py-2.5 px-3">
                                  <span className="inline-flex rounded-full border-2 border-fnorange bg-fnorange/20 px-2 text-xs font-extrabold uppercase text-fnorange">
                                    M{idx + 1}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-semibold">
                                  {member.name}
                                </td>
                                <td className="py-2.5 px-3 font-medium">
                                  {getCurrentMemberId(member)}
                                </td>
                              </motion.tr>
                            ))}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.section>
              </InView>
            </motion.section>
          ) : null}

          {activeTab === "rules" ? (
            <motion.section
              key="dashboard-tab-rules"
              initial={isReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={TAB_PANEL_TRANSITION}
              id="dashboard-panel-rules"
              role="tabpanel"
              aria-labelledby="dashboard-tab-rules"
              className="space-y-6"
            >
              <InView
                once
                viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                transition={{ duration: 0.24, ease: "easeOut" }}
                variants={SCROLL_FLOW_VARIANTS}
              >
                <section className="relative overflow-hidden rounded-2xl border border-b-4 border-fnblue/85 bg-linear-to-br from-background via-white to-fnblue/8 p-6 shadow-lg md:p-8">
                  <div className="pointer-events-none absolute -top-20 -right-14 size-52 rounded-full bg-fnblue/15 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-24 -left-10 size-60 rounded-full bg-fnyellow/12 blur-3xl" />
                  <p className="text-xs font-extrabold uppercase tracking-widest text-fnblue">
                    Event Details
                  </p>
                  <h2 className="mt-3 text-3xl uppercase font-black tracking-tight">
                    {DASHBOARD_EVENT_OVERVIEW.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/85 font-medium">
                    {DASHBOARD_EVENT_OVERVIEW.summary}
                  </p>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl border border-fnblue/45 bg-fnblue/10 p-3 shadow-sm backdrop-blur-sm">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-fnblue">
                        Event Dates
                      </p>
                      <p className="mt-1 text-base md:text-lg font-black tracking-[0.03em] text-foreground">
                        {DASHBOARD_EVENT_OVERVIEW.date}
                      </p>
                    </div>
                    <div className="rounded-xl border border-fngreen/45 bg-fngreen/10 p-3 shadow-sm backdrop-blur-sm">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-fngreen">
                        Registration
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground/90">
                        {DASHBOARD_EVENT_OVERVIEW.registration}
                      </p>
                    </div>
                    <div className="rounded-xl border border-fnorange/45 bg-fnorange/10 p-3 shadow-sm backdrop-blur-sm">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-fnorange">
                        Participation Fee
                      </p>
                      <p className="mt-1 text-sm font-semibold text-foreground/90">
                        {DASHBOARD_EVENT_OVERVIEW.fee}
                      </p>
                    </div>
                  </div>
                </section>
              </InView>

              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <InView
                  once
                  className="h-full"
                  viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                  transition={{ duration: 0.22, ease: "easeOut", delay: 0.03 }}
                  variants={SCROLL_FLOW_VARIANTS}
                >
                  <section className="relative overflow-hidden rounded-2xl border border-b-4 border-fngreen/55 bg-linear-to-br from-white via-white to-fngreen/8 p-6 shadow-lg h-full">
                    <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-fngreen/12 blur-3xl" />
                    <p className="text-xs font-extrabold uppercase tracking-widest text-fngreen">
                      Rulebook At a Glance
                    </p>
                    <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/90 font-medium">
                      {DASHBOARD_QUICK_RULES.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <span className="mt-2 inline-flex size-1 shrink-0 rounded-full bg-fnblue" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                </InView>

                <InView
                  once
                  className="h-full"
                  viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                  transition={{ duration: 0.22, ease: "easeOut", delay: 0.06 }}
                  variants={SCROLL_FLOW_VARIANTS}
                >
                  <section className="relative overflow-hidden rounded-2xl border border-b-4 border-fnorange/95 bg-linear-to-br from-fnorange/18 via-background to-fnblue/12 p-6 shadow-lg h-full">
                    <div className="pointer-events-none absolute -left-16 -bottom-20 size-52 rounded-full bg-fnorange/25 blur-3xl" />
                    <div className="pointer-events-none absolute -right-12 -top-16 size-48 rounded-full bg-fnblue/18 blur-3xl" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-fnorange/60 to-transparent" />

                    <p className="text-xs font-extrabold uppercase tracking-widest text-fnorange">
                      Venue Showcase
                    </p>
                    <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-foreground">
                      Four Signature Campus Arenas
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/85 font-medium">
                      Foundathon 3.0 spans high-impact spaces for fast builds,
                      live reviews, and final pitch energy.
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold uppercase tracking-[0.14em]">
                      <span className="rounded-md border border-fnorange/45 bg-fnorange/15 px-2 py-1 text-center text-fnorange">
                        4 Venues
                      </span>
                      <span className="rounded-md border border-fnblue/45 bg-fnblue/12 px-2 py-1 text-center text-fnblue">
                        3-Day Run
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {DASHBOARD_EVENT_VENUES.map((venue, index) => (
                        <div
                          key={venue}
                          className="group relative overflow-hidden rounded-xl border border-fnorange/45 bg-background/80 px-3 py-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="pointer-events-none absolute -right-7 -top-7 size-16 rounded-full bg-fnorange/14 blur-2xl" />
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-fnorange/80">
                            Zone 0{index + 1}
                          </p>
                          <p className="mt-1 text-sm font-black uppercase tracking-[0.06em] text-foreground">
                            {venue}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </InView>
              </div>

              <div className="grid gap-5 lg:grid-cols-12 auto-rows-fr">
                {DASHBOARD_RULE_SECTIONS.map((section, index) => (
                  <InView
                    key={section.id}
                    once
                    className={cn(
                      "h-full lg:col-span-6",
                      index === 0 && "lg:col-span-7",
                      index === 1 && "lg:col-span-5",
                      index === 2 && "lg:col-span-5",
                      index === 3 && "lg:col-span-7",
                      index === 4 && "lg:col-span-7",
                      index === 5 && "lg:col-span-5",
                      index === 6 && "lg:col-span-4",
                      index === 7 && "lg:col-span-4",
                      index === 8 && "lg:col-span-4",
                    )}
                    viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                    transition={{
                      duration: 0.22,
                      ease: "easeOut",
                      delay: Math.min(index * 0.03, 0.15),
                    }}
                    variants={SCROLL_FLOW_VARIANTS}
                  >
                    <section className="relative h-full overflow-hidden rounded-2xl border border-b-4 border-fngreen/45 bg-linear-to-br from-white via-white to-fnblue/6 p-6 shadow-lg">
                      <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-fnblue/10 blur-3xl" />
                      <p className="text-xs font-extrabold uppercase tracking-widest text-fngreen">
                        {index + 1}. {section.title}
                      </p>
                      <ul className="mt-4 space-y-2 text-sm leading-relaxed text-foreground/90 font-medium">
                        {section.items.map((item) => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-2 inline-flex size-1 shrink-0 rounded-full bg-fnblue" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  </InView>
                ))}
              </div>

              <InView
                once
                viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                transition={{ duration: 0.22, ease: "easeOut", delay: 0.08 }}
                variants={SCROLL_FLOW_VARIANTS}
              >
                <section className="rounded-2xl border border-b-4 border-fnred bg-fnred/5 p-6 shadow-lg">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-fnred">
                    Irreversible Actions
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-fnred/40 bg-fnred/10 px-3 text-xs font-bold uppercase tracking-widest text-fnred">
                      Problem Lock
                    </span>
                    <span className="rounded-full border border-fnred/40 bg-fnred/10 px-3 text-xs font-bold uppercase tracking-widest text-fnred">
                      PPT Submission
                    </span>
                    <span className="rounded-full border border-fnred/40 bg-fnred/10 px-3 text-xs font-bold uppercase tracking-widest text-fnred">
                      Team Recovery on Deletion
                    </span>
                  </div>
                </section>
              </InView>
            </motion.section>
          ) : null}

          {activeTab === "manage" ? (
            <motion.section
              key="dashboard-tab-manage"
              initial={isReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={TAB_PANEL_TRANSITION}
              id="dashboard-panel-manage"
              role="tabpanel"
              aria-labelledby="dashboard-tab-manage"
              className="space-y-6"
            >
              {!hasLockedProblemStatement ? (
                <InView
                  once
                  viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                  transition={{ duration: 0.24, ease: "easeOut", delay: 0.02 }}
                  variants={SCROLL_FLOW_VARIANTS}
                >
                  <section className="rounded-2xl border border-b-4 border-fnred bg-background/95 p-6 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-fnred">
                      Legacy Team Action Required
                    </p>
                    <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                      lock a problem statement now
                    </h3>
                    <p className="mt-2 text-sm text-foreground/75 md:text-base">
                      This team was registered before statement locking was
                      introduced. Choose one statement below to complete your
                      team profile.
                    </p>
                    <p className="mt-2 text-sm font-semibold text-fnred">
                      This is a one-time action. Once locked, the problem
                      statement cannot be changed.
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
                                      isLockingProblemStatementId ===
                                      statement.id
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
                </InView>
              ) : null}

              <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                <InView
                  once
                  viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                  transition={{ duration: 0.24, ease: "easeOut", delay: 0.04 }}
                  variants={SCROLL_FLOW_VARIANTS}
                >
                  <section className="rounded-2xl border border-b-4 border-fnblue bg-background/95 p-6 shadow-lg md:p-8">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-fnblue">
                      Manage Team
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-tight uppercase">
                      Manage Team Roster
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80 font-medium">
                      Add, edit, and remove member profiles. Team identity
                      fields are locked after registration.
                    </p>

                    <div className="mt-6 rounded-xl border border-b-4 border-fnblue/40 bg-white p-4">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-fnblue">
                        Locked Team Profile
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/80 font-medium">
                        These fields are locked after team creation: Team Name,
                        Lead Details
                        {teamType === "non_srm"
                          ? ", College + Club Profile."
                          : "."}
                      </p>
                      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                        <LockedProfileField
                          label="Team Name"
                          value={teamName || "N/A"}
                        />
                        <LockedProfileField
                          label="Lead Name"
                          value={
                            (teamType === "srm"
                              ? leadSrm.name
                              : leadNonSrm.name) || "N/A"
                          }
                        />
                        <LockedProfileField
                          label="Lead ID"
                          value={currentLeadId || "N/A"}
                        />
                        {teamType === "non_srm" ? (
                          <>
                            <LockedProfileField
                              label="College Name"
                              value={metaNonSrm.collegeName || "N/A"}
                            />
                            <LockedProfileField
                              label="Club Profile"
                              value={
                                metaNonSrm.isClub
                                  ? metaNonSrm.clubName || "Club team"
                                  : "Independent Team"
                              }
                            />
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
                            (prev) =>
                              ({ ...prev, [field]: value }) as SrmMember,
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
                            (prev) =>
                              ({ ...prev, [field]: value }) as NonSrmMember,
                          )
                        }
                        className="mt-6 border-b-4 border-fngreen/45"
                      />
                    )}

                    {editingIndex !== null ? (
                      <div className="mt-4 rounded-xl border border-b-4 border-fnorange/50 bg-fnorange/10 p-4">
                        <p className="mb-2 text-xs font-extrabold uppercase tracking-widest text-fnorange">
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
                          hasUnsavedMemberChanges
                            ? "text-fnorange"
                            : "text-fngreen"
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
                </InView>

                <aside className="space-y-4 self-start">
                  <InView
                    once
                    viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                    transition={{
                      duration: 0.22,
                      ease: "easeOut",
                      delay: 0.06,
                    }}
                    variants={SCROLL_FLOW_VARIANTS}
                  >
                    <div className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-6 shadow-lg">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-fngreen">
                        Team Identity
                      </p>
                      <TeamIdentityItem
                        label="Team"
                        value={teamName || "N/A"}
                        className="mt-3"
                      />
                      <TeamIdentityItem
                        label="Team ID"
                        value={teamId}
                        className="mt-1"
                        action={
                          <button
                            type="button"
                            aria-label="Copy Team ID"
                            title="Copy Team ID"
                            className={copyTeamIdButtonClass}
                            onClick={copyTeamId}
                          >
                            <Copy size={14} strokeWidth={2.5} />
                          </button>
                        }
                      />
                      <TeamIdentityItem
                        label="Lead"
                        value={
                          (teamType === "srm"
                            ? leadSrm.name
                            : leadNonSrm.name) || "N/A"
                        }
                      />
                      <TeamIdentityItem
                        label="Lead ID"
                        value={currentLeadId || "N/A"}
                      />
                      {teamType === "non_srm" ? (
                        <>
                          <TeamIdentityItem
                            label="College"
                            value={metaNonSrm.collegeName || "N/A"}
                          />
                          <TeamIdentityItem
                            label="Club"
                            value={
                              metaNonSrm.isClub
                                ? metaNonSrm.clubName || "Club team"
                                : "Independent Team"
                            }
                          />
                        </>
                      ) : null}
                      {/* <p className="mt-3 text-xs text-foreground/70">
                    Created: {formatDateTime(createdAt)}
                  </p> */}
                    </div>
                  </InView>

                  <InView
                    once
                    viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                    transition={{
                      duration: 0.22,
                      ease: "easeOut",
                      delay: 0.1,
                    }}
                    variants={SCROLL_FLOW_VARIANTS}
                  >
                    <div className="rounded-2xl border border-b-4 border-fnyellow bg-background/95 p-6 shadow-lg">
                      <p className="text-xs font-extrabold uppercase tracking-widest text-fnyellow">
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
                              <td className="py-2 pr-3">
                                {currentLeadId || "-"}
                              </td>
                              <td className="py-2 text-right text-foreground/40">
                                -
                              </td>
                            </tr>
                            <AnimatePresence initial={false}>
                              {currentMembers.map((member, idx) => (
                                <motion.tr
                                  key={`${getCurrentMemberId(member)}-${idx}`}
                                  layout={!isReducedMotion}
                                  initial={
                                    isReducedMotion
                                      ? false
                                      : {
                                          opacity: 0,
                                          y: 10,
                                          filter: "blur(2px)",
                                        }
                                  }
                                  animate={{
                                    opacity: 1,
                                    y: 0,
                                    filter: "blur(0px)",
                                  }}
                                  exit={
                                    isReducedMotion
                                      ? undefined
                                      : {
                                          opacity: 0,
                                          y: -8,
                                          filter: "blur(2px)",
                                        }
                                  }
                                  transition={TAB_PANEL_TRANSITION}
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
                                </motion.tr>
                              ))}
                            </AnimatePresence>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </InView>
                </aside>
              </div>
            </motion.section>
          ) : null}

          {activeTab === "actions" ? (
            <motion.section
              key="dashboard-tab-actions"
              initial={isReducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={isReducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={TAB_PANEL_TRANSITION}
              id="dashboard-panel-actions"
              role="tabpanel"
              aria-labelledby="dashboard-tab-actions"
              className="space-y-6"
            >
              <InView
                once
                viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                transition={{ duration: 0.24, ease: "easeOut" }}
                variants={SCROLL_FLOW_VARIANTS}
              >
                <section className="rounded-2xl border border-b-4 border-fnorange bg-background/95 p-6 shadow-lg">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-fnorange">
                    PPT Submission
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-tight uppercase">
                    PPT Submission Controls
                  </h2>
                  <p className="mt-2 text-sm text-foreground/80 font-medium md:text-base">
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
              </InView>

              {!hasLockedProblemStatement ? (
                <InView
                  once
                  viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                  transition={{
                    duration: 0.22,
                    ease: "easeOut",
                    delay: 0.06,
                  }}
                  variants={SCROLL_FLOW_VARIANTS}
                >
                  <section className="rounded-2xl border border-b-4 border-fnred bg-background/95 p-6 shadow-lg">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-fnred">
                      Submission Blocked
                    </p>
                    <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                      lock a problem statement first
                    </h3>
                    <p className="mt-2 text-sm text-foreground/80 font-medium md:text-base">
                      PPT submission is enabled only after your team has an
                      official locked problem statement.
                    </p>
                    <div className="mt-4">
                      <FnButton type="button" onClick={() => goToTab("manage")}>
                        Go to Manage Team
                      </FnButton>
                    </div>
                  </section>
                </InView>
              ) : (
                <InView
                  once
                  viewOptions={SCROLL_FLOW_VIEW_OPTIONS}
                  transition={{
                    duration: 0.22,
                    ease: "easeOut",
                    delay: 0.06,
                  }}
                  variants={SCROLL_FLOW_VARIANTS}
                >
                  <section className="rounded-2xl border border-b-4 border-fngreen bg-background/95 p-6 shadow-lg">
                    <p className="text-xs font-extrabold uppercase tracking-widest text-fngreen">
                      Presentation Submission
                    </p>
                    <h3 className="mt-2 text-2xl font-black uppercase tracking-tight">
                      submit your PPT for review
                    </h3>
                    <p className="mt-2 text-sm text-foreground/80 font-medium md:text-base">
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
                        <p className="text-xs font-extrabold uppercase tracking-widest text-fngreen">
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
                </InView>
              )}
            </motion.section>
          ) : null}
        </AnimatePresence>
      </div>

      {showTeamTicketModal && shouldShowAcceptedQr ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-ticket-title"
          >
            <div
              className={cn(
                "my-auto flex max-h-[calc(100dvh-0.75rem)] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-xl border border-b-4 bg-background shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-2xl",
                selectedTeamTicketTheme.uiModalBorderClass,
              )}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-foreground/10 bg-background px-3 py-3 sm:px-4 md:px-5">
                <div>
                  <p
                    className={cn(
                      "text-[11px] font-extrabold uppercase tracking-widest sm:text-xs",
                      selectedTeamTicketTheme.uiAccentTextClass,
                    )}
                  >
                    Accepted Team Pass
                  </p>
                  <h3
                    id="team-ticket-title"
                    className="mt-1 text-base font-black uppercase tracking-tight sm:text-lg md:text-xl"
                  >
                    Team QR Ticket
                  </h3>
                  <p
                    className={cn(
                      "mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] sm:text-[10px]",
                      selectedTeamTicketTheme.uiChipClass,
                    )}
                  >
                    Style: {selectedTeamTicketTheme.label}
                  </p>
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

              <div className="grid min-h-0 flex-1 grid-rows-[auto_auto] gap-3 overflow-y-auto bg-white/70 p-3 sm:gap-4 sm:p-4 md:grid-cols-[1.2fr_0.8fr] md:grid-rows-1 md:gap-5 md:overflow-hidden md:p-5">
                <div className="min-h-0 rounded-xl border border-foreground/10 bg-foreground/5 p-2.5 sm:p-3">
                  {isGeneratingTeamTicketPreview ? (
                    <div className="flex h-full min-h-44 items-center justify-center rounded-lg bg-foreground/10 sm:min-h-55 md:min-h-65">
                      <div className="h-44 w-full animate-pulse rounded-lg bg-foreground/10 sm:h-55 md:h-65" />
                    </div>
                  ) : teamTicketPreviewError ? (
                    <div className="flex h-full min-h-44 flex-col items-center justify-center rounded-lg border border-fnred/25 bg-fnred/5 px-4 text-center sm:min-h-55 md:min-h-65">
                      <p className="text-sm font-semibold text-fnred">
                        Ticket preview unavailable right now.
                      </p>
                      <p className="mt-2 text-xs font-medium text-foreground/80">
                        You can still download and share using the actions on
                        the right.
                      </p>
                    </div>
                  ) : teamTicketPreviewDataUrl ? (
                    <div className="h-full min-h-44 overflow-hidden rounded-lg border border-foreground/10 bg-white sm:min-h-55 md:min-h-65">
                      <Image
                        src={teamTicketPreviewDataUrl}
                        alt={`Ticket preview for team ${teamName || teamId}`}
                        width={1200}
                        height={675}
                        unoptimized
                        className="h-auto w-full rounded-lg bg-white"
                      />
                    </div>
                  ) : (
                    <div className="flex h-full min-h-44 items-center justify-center rounded-lg border border-foreground/10 bg-background text-sm text-foreground/75 sm:min-h-55 md:min-h-65">
                      Ticket preview is being prepared.
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 rounded-xl border border-foreground/10 bg-background p-3 sm:space-y-3 sm:p-4 md:overflow-y-auto">
                  <p
                    className={cn(
                      "text-xs font-extrabold uppercase tracking-widest",
                      selectedTeamTicketTheme.uiAccentTextClass,
                    )}
                  >
                    Ticket Details
                  </p>
                  <div className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/5 p-2.5 sm:p-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-foreground/70 sm:text-[11px]">
                      Select Ticket Style
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {TEAM_TICKET_THEMES.map((theme) => {
                        const isActiveTheme = teamTicketThemeId === theme.id;
                        return (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => setTeamTicketThemeId(theme.id)}
                            className={cn(
                              "min-w-0 rounded-md border px-2 py-2 text-left transition-[transform,box-shadow,border-color] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-emphasized)] hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnblue/40 sm:px-2.5",
                              isActiveTheme
                                ? theme.uiChipClass
                                : "border-foreground/20 bg-background text-foreground/80",
                            )}
                          >
                            <span
                              className={cn(
                                "block h-1.5 rounded-full bg-linear-to-r",
                                theme.swatchClass,
                              )}
                            />
                            <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.08em] sm:mt-1.5 sm:text-[11px] sm:tracking-[0.11em]">
                              {theme.label}
                            </span>
                            <span className="mt-1 hidden text-[10px] leading-snug text-foreground/70 md:block">
                              {theme.description}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">Team:</span>{" "}
                    {teamName || "Unnamed Team"}
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">Team ID:</span>{" "}
                    <span className="font-mono text-xs">{teamId}</span>
                  </p>
                  <p className="text-xs sm:text-sm">
                    <span className="font-semibold">Track:</span>{" "}
                    {problemStatement.title || "N/A"}
                  </p>
                  <p className="text-xs text-foreground/60">
                    Pick your favorite ticket style, then download this ticket for
                    on-ground check-ins or share instantly on WhatsApp.
                  </p>

                  <div className="space-y-2 pt-1">
                    <FnButton
                      type="button"
                      size="sm"
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
                      size="sm"
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
                      size="sm"
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
        </ModalPortal>
      ) : null}

      {showPresentationPreview && isPresentationSubmitted ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="presentation-preview-title"
          >
            <div className="flex h-[85vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-b-4 border-fnblue bg-background shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-foreground/10 px-4 py-3 md:px-5">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-fnblue">
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
                className="inline-flex size-8 items-center justify-center rounded-md border border-foreground/20 bg-white text-foreground/70 transition-colors hover:bg-fnred/10 hover:text-fnred focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fnred/40"
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
        </ModalPortal>
      ) : null}

      {showPresentationConfirm && pendingPresentationFile ? (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
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
        </ModalPortal>
      ) : null}

      {pendingLockProblemStatement && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
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
                <div className="mt-3 rounded-lg border border-fnred/25 bg-fnred/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fnred">
                    Final Confirmation
                  </p>
                  <p className="mt-1 text-xs text-foreground/75">
                    Type this exact phrase to continue:
                  </p>
                  <p className="mt-2 rounded-md border border-foreground/15 bg-white px-3 py-2 font-mono text-sm font-semibold text-foreground">
                    "{legacyLockConfirmationPhrase}"
                  </p>
                </div>
                <p className="mt-3 text-xs text-foreground/70">
                  Include spaces exactly as shown above.
                </p>
                <input
                  type="text"
                  value={legacyLockConfirmationInput}
                  onChange={(event) =>
                    setLegacyLockConfirmationInput(event.target.value)
                  }
                  placeholder={`Type "${legacyLockConfirmationPhrase}"`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
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
        </ModalPortal>
      )}

      {showDeleteConfirm && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-sm px-4"
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
                <div className="mt-3 rounded-lg border border-fnred/25 bg-fnred/5 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fnred">
                    Final Confirmation
                  </p>
                  <p className="mt-1 text-xs text-foreground/75">
                    Type this exact phrase to continue:
                  </p>
                  <p className="mt-2 rounded-md border border-foreground/15 bg-white px-3 py-2 font-mono text-sm font-semibold text-foreground">
                    "{deleteConfirmationPhrase}"
                  </p>
                </div>
                <p className="mt-3 text-xs text-foreground/70">
                  Include spaces exactly as shown above.
                </p>
                <input
                  type="text"
                  value={deleteConfirmationInput}
                  onChange={(event) =>
                    setDeleteConfirmationInput(event.target.value)
                  }
                  placeholder={`Type "${deleteConfirmationPhrase}"`}
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
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
        </ModalPortal>
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

const LockedProfileField = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <div className="rounded-md border border-foreground/12 bg-foreground/2 px-3 py-2">
    <p className="text-xs font-extrabold text-fnblue">{label}</p>
    <p className="mt-1 font-semibold">{value}</p>
  </div>
);

const TeamIdentityItem = ({
  label,
  value,
  className,
  action,
}: {
  label: string;
  value: string;
  className?: string;
  action?: ReactNode;
}) =>
  action ? (
    <div className={cn("flex items-center gap-2", className)}>
      <p className="text-sm font-bold">
        {label}: <span className="font-medium font-sans">{value}</span>
      </p>
      {action}
    </div>
  ) : (
    <p className={cn("text-sm font-bold", className)}>
      {label}: <span className="font-medium">{value}</span>
    </p>
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
    <p className="text-sm font-extrabold uppercase text-foreground/80">
      {label}
    </p>
    <p className={`text-right ${mono ? "font-mono" : "text-sm font-medium"}`}>
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
    <p className="text-xs font-extrabold uppercase tracking-widest text-gray-600 ml-2 mb-1">
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
    <p className="text-xs font-extrabold uppercase tracking-widest text-fnblue mb-3">
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
    <p className="text-xs font-extrabold uppercase tracking-widest text-gray-600 ml-2 mb-1">
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
