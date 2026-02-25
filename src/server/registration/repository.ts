import { EVENT_ID, EVENT_TITLE } from "@/server/registration/constants";
import type { RouteSupabaseClient } from "@/server/supabase/route-client";

export const listRegistrationsForUser = (
  supabase: RouteSupabaseClient,
  userId: string,
) =>
  supabase
    .from("eventsregistrations")
    .select("id, created_at, details, is_approved")
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .order("created_at", { ascending: false });

export const findRegistrationByTeamIdForUser = (
  supabase: RouteSupabaseClient,
  teamId: string,
  userId: string,
) =>
  supabase
    .from("eventsregistrations")
    .select("id, created_at, details, is_approved")
    .eq("id", teamId)
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .maybeSingle();

export const findAnyRegistrationForUser = (
  supabase: RouteSupabaseClient,
  userId: string,
) =>
  supabase
    .from("eventsregistrations")
    .select("id")
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .maybeSingle();

export const listProblemStatementRows = (supabase: RouteSupabaseClient) =>
  supabase
    .from("eventsregistrations")
    .select("details")
    .eq("event_id", EVENT_ID);

export const insertRegistration = ({
  details,
  registrationEmail,
  supabase,
  userId,
}: {
  details: Record<string, unknown>;
  registrationEmail: string;
  supabase: RouteSupabaseClient;
  userId: string;
}) =>
  supabase
    .from("eventsregistrations")
    .insert([
      {
        application_id: userId,
        details,
        event_id: EVENT_ID,
        event_title: EVENT_TITLE,
        is_team_entry: true,
        registration_email: registrationEmail,
      },
    ])
    .select("id")
    .single();

export const updateRegistrationDetailsByTeamIdForUser = ({
  details,
  supabase,
  teamId,
  userId,
}: {
  details: Record<string, unknown>;
  supabase: RouteSupabaseClient;
  teamId: string;
  userId: string;
}) =>
  supabase
    .from("eventsregistrations")
    .update({ details })
    .eq("id", teamId)
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .select("id, created_at, details, is_approved")
    .maybeSingle();

export const deleteRegistrationByQueryIdForUser = ({
  id,
  supabase,
  userId,
}: {
  id: string;
  supabase: RouteSupabaseClient;
  userId: string;
}) =>
  supabase
    .from("eventsregistrations")
    .delete()
    .eq("id", id)
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .select("id")
    .maybeSingle();

export const deleteRegistrationByTeamIdForUser = ({
  supabase,
  teamId,
  userId,
}: {
  supabase: RouteSupabaseClient;
  teamId: string;
  userId: string;
}) =>
  supabase
    .from("eventsregistrations")
    .delete()
    .eq("id", teamId)
    .eq("event_id", EVENT_ID)
    .eq("application_id", userId)
    .select("id")
    .maybeSingle();
