import { PROBLEM_STATEMENTS } from "@/data/problem-statements";
import {
  getPaymentUpiIdForStatement,
  PAYMENT_AMOUNT_INR,
} from "@/lib/payment-constants";

export const PAYMENT_STATUS_VALUES = [
  "not_submitted",
  "submitted",
  "approved",
  "rejected",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number];

export const DEFAULT_PAYMENT_STATUS: PaymentStatus = "not_submitted";

export const PAYMENT_PROOF_BUCKET_NAME = "foundathon-payment-proofs";
export const PAYMENT_PROOF_REGISTRATIONS_FOLDER = "payment-proofs";
export const PAYMENT_PROOF_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const PAYMENT_PROOF_ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".pdf",
] as const;

export const PAYMENT_PROOF_ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export type PaymentQrConfig = {
  amountInr: number;
  note: string;
  payeeName: string;
  qrLabel: string;
  upiPayload: string;
  vpa: string;
};

const PAYMENT_PROOF_ALLOWED_EXTENSION_SET = new Set(
  PAYMENT_PROOF_ALLOWED_EXTENSIONS,
);
const PAYMENT_PROOF_ALLOWED_MIME_TYPE_SET = new Set(
  PAYMENT_PROOF_ALLOWED_MIME_TYPES,
);

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47] as const;
const JPG_SIGNATURE = [0xff, 0xd8, 0xff] as const;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d] as const;
const WEBP_RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50] as const;

const startsWithSignature = (
  bytes: Uint8Array,
  signature: readonly number[],
) => {
  if (bytes.length < signature.length) {
    return false;
  }

  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      return false;
    }
  }

  return true;
};

const readBlobAsArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === "function") {
    try {
      return await blob.arrayBuffer();
    } catch {
      // Fall through to compatibility readers.
    }
  }

  if (typeof FileReader !== "undefined") {
    return await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read blob."));
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
          return;
        }

        reject(new Error("Unsupported blob reader result."));
      };
      reader.readAsArrayBuffer(blob);
    });
  }

  return await new Response(blob).arrayBuffer();
};

const buildUpiPayload = ({
  amountInr,
  payeeName,
  vpa,
}: {
  amountInr: number;
  payeeName: string;
  vpa: string;
}) =>
  `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(
    payeeName,
  )}&am=${encodeURIComponent(amountInr.toFixed(2))}&cu=INR`;

export const PAYMENT_QR_CONFIG_BY_STATEMENT = Object.fromEntries(
  PROBLEM_STATEMENTS.map((statement) => {
    const statementNumber = statement.id.toUpperCase();
    const payeeName = `Foundathon ${statementNumber}`;
    const vpa = getPaymentUpiIdForStatement(statement.id);
    const note = `Foundathon ${statementNumber} payment`;

    if (!vpa) {
      throw new Error(
        `Missing UPI ID configuration for problem statement ${statement.id}.`,
      );
    }

    return [
      statement.id,
      {
        amountInr: PAYMENT_AMOUNT_INR,
        note,
        payeeName,
        qrLabel: `${statementNumber} INR ${PAYMENT_AMOUNT_INR} UPI`,
        upiPayload: buildUpiPayload({
          amountInr: PAYMENT_AMOUNT_INR,
          payeeName,
          vpa,
        }),
        vpa,
      } satisfies PaymentQrConfig,
    ];
  }),
) as Record<(typeof PROBLEM_STATEMENTS)[number]["id"], PaymentQrConfig>;

export const getPaymentQrConfig = (problemStatementId: string) =>
  PAYMENT_QR_CONFIG_BY_STATEMENT[
    problemStatementId
      .trim()
      .toLowerCase() as keyof typeof PAYMENT_QR_CONFIG_BY_STATEMENT
  ] ?? null;

export const normalizePaymentStatus = (
  value: unknown,
): PaymentStatus | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  return PAYMENT_STATUS_VALUES.includes(normalized as PaymentStatus)
    ? (normalized as PaymentStatus)
    : undefined;
};

export const getPaymentProofExtension = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }

  return normalized.slice(dotIndex);
};

export const isPaymentProofExtensionAllowed = (fileName: string) =>
  PAYMENT_PROOF_ALLOWED_EXTENSION_SET.has(
    getPaymentProofExtension(
      fileName,
    ) as (typeof PAYMENT_PROOF_ALLOWED_EXTENSIONS)[number],
  );

export const isPaymentProofMimeTypeAllowed = (mimeType: string) =>
  PAYMENT_PROOF_ALLOWED_MIME_TYPE_SET.has(
    mimeType
      .trim()
      .toLowerCase() as (typeof PAYMENT_PROOF_ALLOWED_MIME_TYPES)[number],
  );

export const isPaymentProofFileSignatureAllowed = async (
  file: File,
  extensionOverride?: string,
) => {
  const extension = (extensionOverride ?? getPaymentProofExtension(file.name))
    .trim()
    .toLowerCase();
  if (!extension) {
    return false;
  }

  let headerBytes: Uint8Array;
  try {
    const buffer = await readBlobAsArrayBuffer(file.slice(0, 12));
    headerBytes = new Uint8Array(buffer);
  } catch {
    return false;
  }

  if (extension === ".png") {
    return startsWithSignature(headerBytes, PNG_SIGNATURE);
  }

  if (extension === ".jpg" || extension === ".jpeg") {
    return startsWithSignature(headerBytes, JPG_SIGNATURE);
  }

  if (extension === ".pdf") {
    return startsWithSignature(headerBytes, PDF_SIGNATURE);
  }

  if (extension === ".webp") {
    return (
      startsWithSignature(headerBytes, WEBP_RIFF_SIGNATURE) &&
      startsWithSignature(headerBytes.slice(8), WEBP_WEBP_SIGNATURE)
    );
  }

  return false;
};

export const buildPaymentProofStoragePath = ({
  extension,
  teamId,
  userId,
}: {
  extension: string;
  teamId: string;
  userId: string;
}) =>
  `${PAYMENT_PROOF_REGISTRATIONS_FOLDER}/${userId}/${teamId}/proof${extension}`;

export const getPaymentProofStoragePathsForCleanup = ({
  directPath,
  teamId,
  userId,
}: {
  directPath: string;
  teamId: string;
  userId: string;
}) => {
  const paths = new Set<string>();
  const normalizedDirectPath = directPath.trim().replace(/^\/+/, "");
  if (normalizedDirectPath) {
    paths.add(normalizedDirectPath);
  }

  for (const extension of PAYMENT_PROOF_ALLOWED_EXTENSIONS) {
    paths.add(
      buildPaymentProofStoragePath({
        extension,
        teamId,
        userId,
      }),
    );
  }

  return [...paths];
};
