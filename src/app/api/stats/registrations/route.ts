import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getFoundathonStatsApiKey } from "@/server/env";
import { jsonError, jsonNoStore } from "@/server/http/response";
import { getRegistrationStats } from "@/server/registration-stats/service";

const STATS_KEY_HEADER = "x-foundathon-stats-key";

const isValidStatsApiKey = ({
  expected,
  provided,
}: {
  expected: string;
  provided: string;
}) => {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
};

export async function GET(request: NextRequest) {
  const expectedApiKey = getFoundathonStatsApiKey();
  if (!expectedApiKey) {
    return jsonError("Stats API key is not configured.", 500);
  }

  const providedApiKey = request.headers.get(STATS_KEY_HEADER)?.trim();
  if (!providedApiKey) {
    return jsonError("Unauthorized", 401);
  }

  if (
    !isValidStatsApiKey({ expected: expectedApiKey, provided: providedApiKey })
  ) {
    return jsonError("Unauthorized", 401);
  }

  const result = await getRegistrationStats();
  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
