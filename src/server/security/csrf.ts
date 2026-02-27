import { jsonError } from "@/server/http/response";
import { getClientIp } from "@/server/security/client-ip";

const logCsrfReject = ({
  hasOrigin,
  hasReferer,
  ip,
  route,
}: {
  hasOrigin: boolean;
  hasReferer: boolean;
  ip: string;
  route: string;
}) => {
  console.warn(
    JSON.stringify({
      event: "security.csrf_rejected",
      hasOrigin,
      hasReferer,
      ip,
      route,
    }),
  );
};

const hasMatchingOrigin = (
  requestOrigin: string,
  originHeader: string | null,
  refererHeader: string | null,
) => {
  if (originHeader && originHeader.trim() === requestOrigin) {
    return true;
  }

  if (!refererHeader) {
    return false;
  }

  try {
    return new URL(refererHeader).origin === requestOrigin;
  } catch {
    return false;
  }
};

export const enforceSameOrigin = (request: Request) => {
  const url = new URL(request.url);
  const originHeader = request.headers.get("origin");
  const refererHeader = request.headers.get("referer");

  if (hasMatchingOrigin(url.origin, originHeader, refererHeader)) {
    return null;
  }

  logCsrfReject({
    hasOrigin: Boolean(originHeader),
    hasReferer: Boolean(refererHeader),
    ip: getClientIp(request),
    route: url.pathname,
  });

  return jsonError("CSRF validation failed.", 403, { code: "CSRF_FAILED" });
};
