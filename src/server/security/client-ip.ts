const toSingleHeaderValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)[0] ?? "";
};

export const getClientIp = (request: Request) => {
  const cfConnectingIp = toSingleHeaderValue(
    request.headers.get("cf-connecting-ip"),
  );
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const xRealIp = toSingleHeaderValue(request.headers.get("x-real-ip"));
  if (xRealIp) {
    return xRealIp;
  }

  const xForwardedFor = toSingleHeaderValue(
    request.headers.get("x-forwarded-for"),
  );
  if (xForwardedFor) {
    return xForwardedFor;
  }

  return "unknown";
};
