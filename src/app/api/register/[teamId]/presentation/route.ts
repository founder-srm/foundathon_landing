import type { NextRequest } from "next/server";
import { UUID_PATTERN } from "@/lib/register-api";
import { getRouteAuthContext } from "@/server/auth/context";
import { jsonError, jsonNoStore } from "@/server/http/response";
import { submitTeamPresentation } from "@/server/registration/service";

type Params = { params: Promise<{ teamId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return jsonError("Team id is invalid.", 400);
  }

  const context = await getRouteAuthContext();
  if (!context.ok) {
    return context.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Invalid form data payload.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonError("Presentation file is required.", 400);
  }

  const result = await submitTeamPresentation({
    input: { file, teamId },
    supabase: context.supabase,
    userId: context.user.id,
  });

  if (!result.ok) {
    return jsonError(result.error, result.status);
  }

  return jsonNoStore(result.data, result.status);
}
