export const TEAM_CREATED_EVENT = "foundathon:team-created";

export type TeamCreatedEventDetail = {
  teamId: string;
};

export const dispatchTeamCreatedEvent = (teamId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<TeamCreatedEventDetail>(TEAM_CREATED_EVENT, {
      detail: { teamId },
    }),
  );
};

export const isTeamCreatedEventDetail = (
  detail: unknown,
): detail is TeamCreatedEventDetail => {
  if (typeof detail !== "object" || detail === null) {
    return false;
  }

  const maybeDetail = detail as { teamId?: unknown };
  return (
    typeof maybeDetail.teamId === "string" && maybeDetail.teamId.length > 0
  );
};
