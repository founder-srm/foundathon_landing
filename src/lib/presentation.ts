export const PRESENTATION_BUCKET_NAME = "foundathon-presentation";
export const PRESENTATION_REGISTRATIONS_FOLDER = "registrations";
export const PRESENTATION_TEMPLATE_PATH = "/foundathon-ppt-template.pptx";
export const PRESENTATION_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const PRESENTATION_ALLOWED_EXTENSIONS = [".ppt", ".pptx"] as const;
export const PRESENTATION_ALLOWED_MIME_TYPES = [
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
