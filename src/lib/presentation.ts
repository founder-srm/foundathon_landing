export const PRESENTATION_BUCKET_NAME = "foundathon-presentation";
export const PRESENTATION_REGISTRATIONS_FOLDER = "registrations";
export const PRESENTATION_TEMPLATE_PATH = "/foundathon-ppt-template.pptx";
export const PRESENTATION_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const PRESENTATION_ALLOWED_EXTENSIONS = [".ppt", ".pptx"] as const;
export const PRESENTATION_ALLOWED_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const PPT_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] as const;
const PPTX_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
] as const;

const PRESENTATION_ALLOWED_EXTENSION_SET = new Set(
  PRESENTATION_ALLOWED_EXTENSIONS,
);
const PRESENTATION_ALLOWED_MIME_TYPE_SET = new Set(
  PRESENTATION_ALLOWED_MIME_TYPES,
);

export const getPresentationExtension = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  if (dotIndex < 0) {
    return "";
  }

  return normalized.slice(dotIndex);
};

export const isPresentationExtensionAllowed = (fileName: string) =>
  PRESENTATION_ALLOWED_EXTENSION_SET.has(
    getPresentationExtension(
      fileName,
    ) as (typeof PRESENTATION_ALLOWED_EXTENSIONS)[number],
  );

export const isPresentationMimeTypeAllowed = (mimeType: string) =>
  PRESENTATION_ALLOWED_MIME_TYPE_SET.has(
    mimeType
      .trim()
      .toLowerCase() as (typeof PRESENTATION_ALLOWED_MIME_TYPES)[number],
  );

const startsWithSignature = (
  bytes: Uint8Array,
  signature: readonly number[],
) => {
  if (bytes.length < signature.length) {
    return false;
  }

  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[i] !== signature[i]) {
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

export const isPresentationFileSignatureAllowed = async (
  file: File,
  extensionOverride?: string,
) => {
  const extension = (extensionOverride ?? getPresentationExtension(file.name))
    .trim()
    .toLowerCase();
  if (!extension) {
    return false;
  }

  let headerBytes: Uint8Array;
  try {
    const maxSignatureLength = Math.max(
      PPT_SIGNATURE.length,
      ...PPTX_SIGNATURES.map((signature) => signature.length),
    );
    const headerBlob = file.slice(0, maxSignatureLength);
    const buffer = await readBlobAsArrayBuffer(headerBlob);
    headerBytes = new Uint8Array(buffer);
  } catch {
    return false;
  }

  if (extension === ".ppt") {
    return startsWithSignature(headerBytes, PPT_SIGNATURE);
  }

  if (extension === ".pptx") {
    return PPTX_SIGNATURES.some((signature) =>
      startsWithSignature(headerBytes, signature),
    );
  }

  return false;
};
