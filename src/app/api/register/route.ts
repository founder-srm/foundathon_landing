import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { teamSubmissionSchema } from "@/lib/register-schema";

const JSON_HEADERS = { "Cache-Control": "no-store" };
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_ID =
  process.env.NEXT_PUBLIC_FOUNDATHON_EVENT_ID ??
  "583a3b40-da9d-412a-a266-cc7e64330b16";

type TeamSummary = {
  id: string;
  teamName: string;
  teamType: "srm" | "non_srm";
  leadName: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

type RegistrationRow = {
  id: string;
  created_at: string;
  updated_at: string | null;
  details: Record<string, unknown> | null;
};

const isJsonRequest = (request: NextRequest) =>
  request.headers.get("content-type")?.includes("application/json");

const parseRequestJson = async (request: NextRequest): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return null;
  }
};

const getSupabaseEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables.");
  }
  return { url, anonKey };
};

async function createSupabaseClient() {
  const { url, anonKey } = getSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

function transformToLegacyFormat(data: unknown) {
  const parsed = teamSubmissionSchema.parse(data);
  const allMembers = [parsed.lead, ...parsed.members];

  return {
    teamName: parsed.teamName,
    teamType: parsed.teamType,
    memberCount: allMembers.length,
    fullName1: allMembers[0]?.name ?? null,
    rollNumber1:
      parsed.teamType === "srm" ? (allMembers[0]?.raNumber ?? null) : null,
    dept1: parsed.teamType === "srm" ? (allMembers[0]?.dept ?? null) : null,
    fullName2: allMembers[1]?.name ?? null,
    rollNumber2:
      parsed.teamType === "srm" ? (allMembers[1]?.raNumber ?? null) : null,
    dept2: parsed.teamType === "srm" ? (allMembers[1]?.dept ?? null) : null,
    fullName3: allMembers[2]?.name ?? null,
    rollNumber3:
      parsed.teamType === "srm" ? (allMembers[2]?.raNumber ?? null) : null,
    dept3: parsed.teamType === "srm" ? (allMembers[2]?.dept ?? null) : null,
    fullName4: allMembers[3]?.name ?? null,
    rollNumber4:
      parsed.teamType === "srm" ? (allMembers[3]?.raNumber ?? null) : null,
    dept4: parsed.teamType === "srm" ? (allMembers[3]?.dept ?? null) : null,
    fullName5: allMembers[4]?.name ?? null,
    rollNumber5:
      parsed.teamType === "srm" ? (allMembers[4]?.raNumber ?? null) : null,
    dept5: parsed.teamType === "srm" ? (allMembers[4]?.dept ?? null) : null,
    whatsAppNumber: parsed.lead.contact ?? null,
    paymentAgreement: true,
  };
}

function toTeamSummary(row: RegistrationRow): TeamSummary {
  const details = row.details ?? {};
  const fullNames = [
    details.fullName1,
    details.fullName2,
    details.fullName3,
    details.fullName4,
    details.fullName5,
  ];

  const memberCount = fullNames.filter(
    (name) => typeof name === "string" && name.trim().length > 0,
  ).length;

  return {
    id: row.id,
    teamName:
      typeof details.teamName === "string" && details.teamName.trim().length > 0
        ? details.teamName
        : "Unnamed Team",
    teamType: details.teamType === "non_srm" ? "non_srm" : "srm",
    leadName:
      typeof details.fullName1 === "string" &&
      details.fullName1.trim().length > 0
        ? details.fullName1
        : "Unknown Lead",
    memberCount: Math.max(memberCount, 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export async function GET() {
  const supabase = await createSupabaseClient();
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

  const { data, error } = await supabase
    .from("eventsregistrations")
    .select("id, created_at, updated_at, details")
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch registrations." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  const teams = (data ?? []).map((row) =>
    toTeamSummary(row as RegistrationRow),
  );
  return NextResponse.json({ teams }, { headers: JSON_HEADERS });
}

export async function POST(request: NextRequest) {
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

  const supabase = await createSupabaseClient();
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

  const { data: existing } = await supabase
    .from("eventsregistrations")
    .select("id")
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You have already registered for this event." },
      { status: 409, headers: JSON_HEADERS },
    );
  }

  const legacyDetails = transformToLegacyFormat(parsed.data);

  const { data, error } = await supabase
    .from("eventsregistrations")
    .insert([
      {
        event_id: EVENT_ID,
        event_title: "Foundathon 3.0",
        application_id: user.id,
        details: legacyDetails,
        registration_email: user.email,
        is_team_entry: true,
      },
    ])
    .select("id, created_at, updated_at, details")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to register team." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  return NextResponse.json(
    {
      team: { id: data.id },
      teams: [toTeamSummary(data as RegistrationRow)],
    },
    { status: 201, headers: JSON_HEADERS },
  );
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json(
      { error: "Team id is required." },
      { status: 400, headers: JSON_HEADERS },
    );
  }
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      { error: "Team id is invalid." },
      { status: 400, headers: JSON_HEADERS },
    );
  }

  const supabase = await createSupabaseClient();
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

  const { data: deleted, error: deleteError } = await supabase
    .from("eventsregistrations")
    .delete()
    .eq("id", id)
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .select("id")
    .maybeSingle();

  if (deleteError) {
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

  const { data, error } = await supabase
    .from("eventsregistrations")
    .select("id, created_at, updated_at, details")
    .eq("event_id", EVENT_ID)
    .eq("application_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Deleted team, but failed to refresh list." },
      { status: 500, headers: JSON_HEADERS },
    );
  }

  const teams = (data ?? []).map((row) =>
    toTeamSummary(row as RegistrationRow),
  );
  return NextResponse.json({ teams }, { headers: JSON_HEADERS });
}
