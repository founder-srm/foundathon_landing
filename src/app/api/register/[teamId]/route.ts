import { type NextRequest, NextResponse } from "next/server";
import {
  createSupabaseClient,
  EVENT_ID,
  getSupabaseCredentials,
  JSON_HEADERS,
  type RegistrationRow,
  toTeamRecord,
  UUID_PATTERN,
  withSrmEmailNetIds,
} from "@/lib/register-api";
import { teamSubmissionSchema } from "@/lib/register-schema";

type Params = { params: Promise<{ teamId: string }> };

const isJsonRequest = (request: NextRequest) =>
  request.headers.get("content-type")?.includes("application/json");

const parseRequestJson = async (request: NextRequest): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const missingSupabaseConfigResponse = () =>
  NextResponse.json(
    { error: "Supabase environment variables are not configured." },
    { status: 500, headers: JSON_HEADERS },
  );

const PROBLEM_STATEMENT_DETAIL_KEYS = [
  "problemStatementId",
  "problemStatementTitle",
  "problemStatementCap",
  "problemStatementLockedAt",
] as const;

const findTeamById = async ({
  supabase,
  teamId,
  userId,
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>;
  teamId: string;
  userId: string;
}) =>
  supabase
    .from("eventsregistrations")
    .select("id, created_at, details")
    .eq("id", teamId)
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .maybeSingle();

export async function GET(_: NextRequest, { params }: Params) {
  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return NextResponse.json(
      { error: "Team id is invalid." },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const credentials = getSupabaseCredentials();
  if (!credentials) return missingSupabaseConfigResponse();

  const supabase = await createSupabaseClient(credentials);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const { data, error } = await findTeamById({
    supabase,
    teamId,
    userId: user.id,
  });

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch team." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Team not found." },
      { status: 404, headers: JSON_HEADERS },
    );
  }

  const team = toTeamRecord(data as RegistrationRow);
  if (!team) {
    return NextResponse.json(
      { error: "Team data is incomplete or outdated." },
      { status: 422, headers: JSON_HEADERS },
    );
  }

  return NextResponse.json({ team }, { headers: JSON_HEADERS });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return NextResponse.json(
      { error: "Team id is invalid." },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  if (!isJsonRequest(request)) {
    return NextResponse.json(
      { error: "Content-Type must be application/json." },
      { status: 415, headers: JSON_HEADERS },
    );
  }

  const body = await parseRequestJson(request);
  if (body === null) {
    return NextResponse.json(
      { error: "Invalid JSON payload." },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const parsed = teamSubmissionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const credentials = getSupabaseCredentials();
  if (!credentials) return missingSupabaseConfigResponse();

  const supabase = await createSupabaseClient(credentials);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const { data: existingTeam, error: existingTeamError } = await findTeamById({
    supabase,
    teamId,
    userId: user.id,
  });

  if (existingTeamError) {
    return NextResponse.json(
      { error: existingTeamError.message || "Failed to fetch team." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  if (!existingTeam) {
    return NextResponse.json(
      { error: "Team not found." },
      { status: 404, headers: JSON_HEADERS },
    );
  }

  const existingDetails =
    existingTeam.details && typeof existingTeam.details === "object"
      ? (existingTeam.details as Record<string, unknown>)
      : {};
  const updatedDetails: Record<string, unknown> = withSrmEmailNetIds(
    parsed.data,
  );

  for (const key of PROBLEM_STATEMENT_DETAIL_KEYS) {
    const value = existingDetails[key];

    if (typeof value === "string" && value.trim().length > 0) {
      updatedDetails[key] = value;
      continue;
    }

    if (
      key === "problemStatementCap" &&
      typeof value === "number" &&
      Number.isInteger(value) &&
      value > 0
    ) {
      updatedDetails[key] = value;
    }
  }

  const { data, error } = await supabase
    .from("eventsregistrations")
    .update({ details: updatedDetails })
    .eq("id", teamId)
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .select("id, created_at, details")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to update team." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Team not found." },
      { status: 404, headers: JSON_HEADERS },
    );
  }

  const team = toTeamRecord(data as RegistrationRow);
  if (!team) {
    return NextResponse.json(
      { error: "Team data is incomplete or outdated." },
      { status: 422, headers: JSON_HEADERS },
    );
  }

  return NextResponse.json({ team }, { headers: JSON_HEADERS });
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { teamId } = await params;
  if (!UUID_PATTERN.test(teamId)) {
    return NextResponse.json(
      { error: "Team id is invalid." },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const credentials = getSupabaseCredentials();
  if (!credentials) return missingSupabaseConfigResponse();

  const supabase = await createSupabaseClient(credentials);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: JSON_HEADERS },
    );
  }

  const { data: deleted, error } = await supabase
    .from("eventsregistrations")
    .delete()
    .eq("id", teamId)
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to remove team." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  if (!deleted) {
    return NextResponse.json(
      { error: "Team not found." },
      { status: 404, headers: JSON_HEADERS },
    );
  }

  return NextResponse.json({ deleted: true }, { headers: JSON_HEADERS });
}
