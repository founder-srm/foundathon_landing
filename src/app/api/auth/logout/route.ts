import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const signOutUser = async () => {
  const cookieStore = cookies();
  const supabase = await createClient(cookieStore);
  await supabase.auth.signOut();
};

export async function GET(request: Request) {
  await signOutUser();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/`, { status: 303 });
}

export async function POST() {
  await signOutUser();
  return NextResponse.json({ ok: true });
}
