"use client";

import { PlusIcon, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FnButton } from "@/components/ui/fn-button";
import { toast } from "@/hooks/use-toast";
import { type NonSrmMember, nonSrmMemberSchema, type SrmMember, srmMemberSchema, type TeamRecord, teamSubmissionSchema } from "@/lib/register-schema";
import { create } from "node:domain";
import { Plus, PlusIcon, Trash2 } from "lucide-react";

type TeamType = "srm" | "non_srm";

type NonSrmMeta = {
  collegeName: string;
  isClub: boolean;
  clubName: string;
};

type TeamSummary = {
  id: string;
  teamName: string;
  teamType: TeamType;
  leadName: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

const MIN_MEMBERS = 3;
const MAX_MEMBERS = 5;

const emptySrmMember = (): SrmMember => ({
  name: "",
  raNumber: "",
  netId: "",
  dept: "",
  contact: 0,
});

const emptyNonSrmMember = (): NonSrmMember => ({
  name: "",
  collegeId: "",
  collegeEmail: "",
  contact: 0,
});

const emptyNonSrmMeta = (): NonSrmMeta => ({
  collegeName: "",
  isClub: false,
  clubName: "",
});

const Register = () => {
  const router = useRouter();
  const [teamType, setTeamType] = useState<TeamType>("srm");
  const [teamName, setTeamName] = useState("");

  const [leadSrm, setLeadSrm] = useState<SrmMember>(emptySrmMember);
  const [membersSrm, setMembersSrm] = useState<SrmMember[]>([]);
  const [memberDraftSrm, setMemberDraftSrm] =
    useState<SrmMember>(emptySrmMember);

  const [leadNonSrm, setLeadNonSrm] = useState<NonSrmMember>(emptyNonSrmMember);
  const [membersNonSrm, setMembersNonSrm] = useState<NonSrmMember[]>([]);
  const [memberDraftNonSrm, setMemberDraftNonSrm] =
    useState<NonSrmMember>(emptyNonSrmMember);
  const [nonSrmMeta, setNonSrmMeta] = useState<NonSrmMeta>(emptyNonSrmMeta);

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentMembers = teamType === "srm" ? membersSrm : membersNonSrm;
  const currentLead = teamType === "srm" ? leadSrm : leadNonSrm;
  const currentLeadId =
    teamType === "srm" ? leadSrm.netId : leadNonSrm.collegeId;
  const memberCount = 1 + currentMembers.length;
  const getCurrentMemberId = (member: SrmMember | NonSrmMember) =>
    teamType === "srm"
      ? (member as SrmMember).netId
      : (member as NonSrmMember).collegeId;

  const canAddMember = memberCount < MAX_MEMBERS;
  const canSubmit = memberCount >= MIN_MEMBERS && memberCount <= MAX_MEMBERS;

  const completedProfiles = useMemo(() => {
    if (teamType === "srm") {
      const leadOk = srmMemberSchema.safeParse(leadSrm).success ? 1 : 0;
      const membersOk = membersSrm.filter(
        (item) => srmMemberSchema.safeParse(item).success,
      ).length;
      return leadOk + membersOk;
    }

    const leadOk = nonSrmMemberSchema.safeParse(leadNonSrm).success ? 1 : 0;
    const membersOk = membersNonSrm.filter(
      (item) => nonSrmMemberSchema.safeParse(item).success,
    ).length;
    return leadOk + membersOk;
  }, [leadNonSrm, leadSrm, membersNonSrm, membersSrm, teamType]);

  const loadTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/register", { method: "GET" });
      const data = (await res.json()) as { teams?: TeamSummary[] };
      setTeams(data.teams || []);
    } catch {
      toast({
        title: "Status Update",
        description: "Failed to load local team records.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const updateSrmLead = (field: keyof SrmMember, value: string | number) => {
    setLeadSrm((prev) => ({ ...prev, [field]: value }) as SrmMember);
  };

  const updateSrmDraft = (field: keyof SrmMember, value: string | number) => {
    setMemberDraftSrm((prev) => ({ ...prev, [field]: value }) as SrmMember);
  };

  const updateNonSrmLead = (
    field: keyof NonSrmMember,
    value: string | number,
  ) => {
    setLeadNonSrm((prev) => ({ ...prev, [field]: value }) as NonSrmMember);
  };

  const updateNonSrmDraft = (
    field: keyof NonSrmMember,
    value: string | number,
  ) => {
    setMemberDraftNonSrm(
      (prev) => ({ ...prev, [field]: value }) as NonSrmMember,
    );
  };

  const addMember = () => {
    if (!canAddMember) return;

    if (teamType === "srm") {
      const parsed = srmMemberSchema.safeParse(memberDraftSrm);
      if (!parsed.success) {
        toast({
          title: "Validation Error",
          description:
            parsed.error.issues[0]?.message ?? "Invalid member details.",
          variant: "destructive",
        });
        return;
      }
      setMembersSrm((prev) => [...prev, parsed.data]);
      setMemberDraftSrm(emptySrmMember());
    } else {
      const parsed = nonSrmMemberSchema.safeParse(memberDraftNonSrm);
      if (!parsed.success) {
        toast({
          title: "Validation Error",
          description:
            parsed.error.issues[0]?.message ?? "Invalid member details.",
          variant: "destructive",
        });
        return;
      }
      setMembersNonSrm((prev) => [...prev, parsed.data]);
      setMemberDraftNonSrm(emptyNonSrmMember());
    }

    toast({
      title: "Status Update",
      description: "Member added to preview.",
      variant: "success",
    });
  };

  const removeMember = (index: number) => {
    if (teamType === "srm") {
      setMembersSrm((prev) => prev.filter((_, idx) => idx !== index));
    } else {
      setMembersNonSrm((prev) => prev.filter((_, idx) => idx !== index));
    }
  };

  const clearCurrentTeam = () => {
    setTeamName("");
    if (teamType === "srm") {
      setLeadSrm(emptySrmMember());
      setMemberDraftSrm(emptySrmMember());
      setMembersSrm([]);
    } else {
      setLeadNonSrm(emptyNonSrmMember());
      setMemberDraftNonSrm(emptyNonSrmMember());
      setMembersNonSrm([]);
      setNonSrmMeta(emptyNonSrmMeta());
    }
    toast({
      title: "Status Update",
      description: "Current form cleared.",
      variant: "success",
    });
  };

  const submitTeam = async () => {
    const payload =
      teamType === "srm"
        ? {
            teamType: "srm" as const,
            teamName,
            lead: leadSrm,
            members: membersSrm,
          }
        : {
            teamType: "non_srm" as const,
            teamName,
            collegeName: nonSrmMeta.collegeName,
            isClub: nonSrmMeta.isClub,
            clubName: nonSrmMeta.isClub ? nonSrmMeta.clubName : "",
            lead: leadNonSrm,
            members: membersNonSrm,
          };

    const parsed = teamSubmissionSchema.safeParse(payload);
    if (!parsed.success) {
      toast({
        title: "Validation Error",
        description:
          parsed.error.issues[0]?.message ?? "Please check entered details.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as {
        error?: string;
        team?: { id: string };
        teams?: TeamSummary[];
      };

      if (!res.ok || !data.team?.id) {
        toast({
          title: "Validation Error",
          description: data.error ?? "Failed to save team.",
          variant: "destructive",
        });
        return;
      }
      // Transform team records to summaries
      const teamSummaries = (data.teams ?? []).map((team) => ({
        id: team.id,
        teamName: team.teamName,
        teamType: team.teamType,
        leadName: team.lead.name,
        memberCount: team.members.length,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      }));

      setTeams(teamSummaries);
      router.push(`/register/success/${data.team.id}`);
    } catch {
      toast({
        title: "Validation Error",
        description: "Network error while saving team.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteTeam = async (id: string) => {
    try {
      const res = await fetch(`/api/register?id=${id}`, { method: "DELETE" });
      const data = (await res.json()) as { teams?: TeamSummary[] };
      if (!res.ok) {
        toast({
          title: "Error",
          description: "Failed to delete team.",
          variant: "destructive",
        });
        return;
      }
      setTeams(data.teams ?? []);
      toast({
        title: "Status Update",
        description: "Saved team removed.",
        variant: "success",
      });
    } catch {
      toast({
        title: "Error",
        description: "Network error while deleting team.",
        variant: "destructive",
      });
    }
  };

  return (
    <main className="min-h-screen bg-gray-200 text-foreground relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-45 pointer-events-none"
        style={{ backgroundImage: "url(/textures/circle-16px.svg)" }}
      />
      <div className="fncontainer relative py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border bg-background/95 p-6 md:p-8 shadow-lg border-b-4 border-fnblue backdrop-blur-sm">
            <div className="space-y-4">
              {/* <p className="inline-flex rounded-full border-2 border-fngreen bg-fngreen/20 px-3  text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-fngreen">
                Foundathon 3.0 Registration
              </p> */}
              <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
                onboarding wizard
              </h1>
              <p className="text-foreground/70">
                Step through the form and build your team in minutes.
              </p>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  {
                    label: "1. Team Type",
                    tone: "border-fnblue/40 bg-fnblue/10",
                  },
                  {
                    label: "2. Team Name",
                    tone: "border-fngreen/40 bg-fngreen/10",
                  },
                  {
                    label: "3. Team Lead",
                    tone: "border-fnyellow/40 bg-fnyellow/20",
                  },
                  {
                    label: "4. Add + Submit",
                    tone: "border-fnred/40 bg-fnred/10",
                  },
                ].map((step) => (
                  <p
                    key={step.label}
                    className={`rounded-md border px-2 py-2 text-[10px] uppercase tracking-[0.16em] font-bold ${step.tone}`}
                  >
                    {step.label}
                  </p>
                ))}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 shadow-sm">
              <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3 text-fnblue">
                Team Type
              </p>
              <label className="block">
                <p className="text-[11px] uppercase tracking-[0.2em] text-foreground/70 font-semibold mb-2">Select Team Category</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTeamType("srm")}
                    className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.08em] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-fnblue/50 ${
                      teamType === "srm"
                        ? "border-fnblue bg-fnblue text-white"
                        : "border-fnblue/35 bg-white text-foreground hover:bg-fnblue/10"
                    }`}
                  >
                    SRM
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeamType("non_srm")}
                    className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.08em] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-fnblue/50 ${
                      teamType === "non_srm"
                        ? "border-fnblue bg-fnblue text-white"
                        : "border-fnblue/35 bg-white text-foreground hover:bg-fnblue/10"
                    }`}
                  >
                    Non-SRM
                  </button>
                </div>
              </label>
            </div>

            <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
              <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3 text-fnblue">Team Identity</p>
              <Input label="Team Name" value={teamName} onChange={setTeamName} />
            </div>

            {teamType === "non_srm" && (
              <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
                <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3 text-fnblue">
                  Non-SRM Team Info
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="College Name"
                    value={nonSrmMeta.collegeName}
                    onChange={(value) =>
                      setNonSrmMeta((prev) => ({ ...prev, collegeName: value }))
                    }
                  />
                </div>
                <label className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
                  <input
                    type="checkbox"
                    checked={nonSrmMeta.isClub}
                    onChange={(event) =>
                      setNonSrmMeta((prev) => ({
                        ...prev,
                        isClub: event.target.checked,
                        clubName: event.target.checked ? prev.clubName : "",
                      }))
                    }
                  />
                  Team represents a club
                </label>
                <div className="mt-3">
                  <Input
                    label="Club Name (or empty)"
                    value={nonSrmMeta.clubName}
                    onChange={(value) =>
                      setNonSrmMeta((prev) => ({ ...prev, clubName: value }))
                    }
                  />
                </div>
              </div>
            )}

            {teamType === "srm" ? (
              <>
                <SrmMemberEditor
                  title="Team Lead"
                  member={leadSrm}
                  onChange={updateSrmLead}
                  className="mt-6"
                />
                <MemberDraftCard
                  canAddMember={canAddMember}
                  onAdd={addMember}
                  count={membersSrm.length + 2}
                >
                  <SrmMemberEditor
                    title={`Member Draft (${membersSrm.length + 2})`}
                    member={memberDraftSrm}
                    onChange={updateSrmDraft}
                  />
                </MemberDraftCard>
              </>
            ) : (
              <>
                <NonSrmMemberEditor
                  title="Team Lead"
                  member={leadNonSrm}
                  onChange={updateNonSrmLead}
                  className="mt-6"
                />
                <MemberDraftCard
                  canAddMember={canAddMember}
                  onAdd={addMember}
                  count={membersNonSrm.length + 2}
                >
                  <NonSrmMemberEditor
                    title={`Member Draft (${membersNonSrm.length + 2})`}
                    member={memberDraftNonSrm}
                    onChange={updateNonSrmDraft}
                  />
                </MemberDraftCard>
              </>
            )}

            <p className="mt-4 text-xs uppercase tracking-[0.18em] font-semibold text-foreground/70">
              Team size required: 3 to 5 (including lead)
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <FnButton type="button" onClick={clearCurrentTeam} tone="gray">
                Clear
              </FnButton>
              <FnButton type="button" onClick={submitTeam} disabled={!canSubmit || isSubmitting} className="cursor-pointer">
                {isSubmitting ? "Saving..." : "Create Team"}
              </FnButton>
            </div>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-10 self-start pr-1">
            <div className="rounded-2xl border bg-background/95 p-6 shadow-md border-b-4 border-fnyellow backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-foreground/70 font-semibold">
                Team Status
              </p>
              <h3 className="text-2xl font-black uppercase tracking-tight mt-2">
                live progress
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-foreground/20 bg-linear-to-r from-foreground/8 to-foreground/4 p-3 flex justify-between items-center">
                  <p className="text-[10px] uppercase text-foreground/80 tracking-[0.18em] font-semibold">
                    Team Type
                  </p>
                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                        teamType === "srm"
                          ? "border-fnblue/50 bg-fnblue/20 text-fnblue"
                          : "border-fnred/50 bg-fnred/20 text-fnred"
                      }`}
                    >
                      {teamType === "srm" ? "SRM Squad" : "Non-SRM Squad"}
                    </span>
                  </div>
                </div>
                <StatusLine
                  label="Team Name"
                  value={teamName || "N/A"}
                  tone="blue"
                />
                <StatusLine
                  label="Members"
                  value={`${memberCount}/${MAX_MEMBERS}`}
                  tone="orange"
                />
                <StatusLine
                  label="Completed Profiles"
                  value={`${completedProfiles}/${memberCount}`}
                  tone="green"
                />
                <StatusLine
                  label="Saved Teams"
                  value={`${teams.length}`}
                  tone="red"
                />
              </div>
            </div>

            <div className="rounded-2xl border bg-background/95 p-6 shadow-md border-b-4 border-fnblue backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-foreground/70 font-semibold">
                Live Team Members
              </p>
              <p className="text-sm text-foreground/70 mt-1">
                Manage members directly from this table.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-foreground/10">
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.12em] text-xs">
                        Role
                      </th>
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.12em] text-xs">
                        Name
                      </th>
                      <th className="py-2 pr-3 font-semibold uppercase tracking-[0.12em] text-xs">
                        {teamType === "srm" ? "NetID" : "College ID"}
                      </th>
                      <th className="py-2 font-semibold uppercase tracking-[0.12em] text-xs">
                        Contact
                      </th>
                      <th className="py-2 pl-2 text-right font-semibold uppercase tracking-[0.12em] text-xs">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-foreground/10">
                      <td className="py-2 pr-3 font-bold text-fnblue">Lead</td>
                      <td className="py-2 pr-3">{currentLead.name || "-"}</td>
                      <td className="py-2 pr-3">{currentLeadId || "-"}</td>
                      <td className="py-2">{currentLead.contact || "-"}</td>
                      <td className="py-2 pl-2 text-right text-foreground/40">
                        -
                      </td>
                    </tr>
                    {currentMembers.map((member, index) => (
                      <tr
                        key={`${getCurrentMemberId(member)}-${index}`}
                        className="border-b border-foreground/10"
                      >
                        <td className="py-2 pr-3 font-semibold">
                          M{index + 1}
                        </td>
                        <td className="py-2 pr-3">{member.name}</td>
                        <td className="py-2 pr-3">
                          {getCurrentMemberId(member)}
                        </td>
                        <td className="py-2">{member.contact}</td>
                        <td className="py-2 pl-2 text-right">
                          <FnButton
                            type="button"
                            onClick={() => removeMember(index)}
                            tone="red"
                            size="xs"
                            title="Remove Member"
                            className="cursor-pointer"
                          >
                            <Trash2 size={16} strokeWidth={3} />
                          </FnButton>
                        </td>
                      </tr>
                    ))}
                    {currentMembers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-3 text-foreground/60 text-center"
                        >
                          No members added yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-2xl border bg-background/95 p-6 shadow-md border-b-4 border-fnred backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.22em] text-foreground/70 font-semibold">
                Saved Teams (JSON)
              </p>
              <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
                {isLoading && (
                  <p className="text-sm text-foreground/60">Loading teams...</p>
                )}
                {!isLoading && teams.length === 0 && (
                  <p className="text-sm text-foreground/60">
                    No saved teams yet.
                  </p>
                )}
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="rounded-lg border border-foreground/10 bg-gray-100 p-3"
                  >
                    <p className="text-sm font-bold">{team.teamName}</p>
                    <p className="text-xs text-foreground/70 mt-1">
                      Lead: {team.leadName} | {team.memberCount} members
                    </p>
                    <FnButton
                      type="button"
                      onClick={() => deleteTeam(team.id)}
                      tone="red"
                      size="xs"
                      className="mt-2"
                    >
                      Delete
                    </FnButton>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
};

const MemberDraftCard = ({
  canAddMember,
  onAdd,
  count,
  children,
}: {
  canAddMember: boolean;
  onAdd: () => void;
  count: number;
  children: React.ReactNode;
}) => (
  <div className="mt-6 rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm">
    <div className="flex items-center justify-between gap-3 mb-3 h-13">
      <p className="text-base font-bold uppercase tracking-[0.08em]">Add Member Individually</p>
      <FnButton type="button" onClick={onAdd} disabled={!canAddMember} tone="green" size="sm" className="cursor-pointer">
        <PlusIcon size={16} strokeWidth={3} />
        Add Member
      </FnButton>
    </div>
    {children}
    <p className="mt-3 text-[10px] uppercase tracking-[0.18em] font-semibold text-foreground/60">
      Next member slot: {count}
    </p>
  </div>
);

type InputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

const Input = ({ label, value, onChange, type = "text", required = false, minLength, maxLength, pattern }: InputProps) => (
  <label className="block">
    <p className="text-xs uppercase tracking-[0.2em] text-foreground/70 font-semibold mb-1">
      {label}
    </p>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
      className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
    />
  </label>
);

type SrmEditorProps = {
  title: string;
  member: SrmMember;
  onChange: (field: keyof SrmMember, value: string | number) => void;
  className?: string;
};

const SrmMemberEditor = ({
  title,
  member,
  onChange,
  className = "",
}: SrmEditorProps) => (
  <div
    className={`rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm ${className}`}
  >
    <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input
        label="Name"
        value={member.name}
        onChange={(v) => onChange("name", v)}
      />
      <Input
        label="Registration Number"
        value={member.raNumber}
        onChange={(v) => onChange("raNumber", v)}
      />
      <Input
        label="NetID"
        value={member.netId}
        onChange={(v) => onChange("netId", v)}
      />
      <Input
        label="Department"
        value={member.dept}
        onChange={(v) => onChange("dept", v)}
      />
      <div className="md:col-span-2">
        <NumberInput
          label="Contact"
          value={member.contact}
          onChange={(v) => onChange("contact", v)}
        />
      </div>
    </div>
  </div>
);

type NonSrmEditorProps = {
  title: string;
  member: NonSrmMember;
  onChange: (field: keyof NonSrmMember, value: string | number) => void;
  className?: string;
};

const NonSrmMemberEditor = ({
  title,
  member,
  onChange,
  className = "",
}: NonSrmEditorProps) => (
  <div
    className={`rounded-xl border border-foreground/10 bg-linear-to-b from-gray-100 to-gray-50 p-4 md:p-5 shadow-sm ${className}`}
  >
    <p className="text-sm md:text-base font-bold uppercase tracking-[0.08em] mb-3">
      {title}
    </p>
    <div className="grid gap-3 md:grid-cols-2">
      <Input label="Name" value={member.name} onChange={(v) => onChange("name", v)} required minLength={2} maxLength={100} />
      <Input label="College ID Number" value={member.collegeId} onChange={(v) => onChange("collegeId", v)} required minLength={3} maxLength={50} />
      <Input label="College Email" value={member.collegeEmail} onChange={(v) => onChange("collegeEmail", v)} type="email" required />
      <NumberInput label="Contact" value={member.contact} onChange={(v) => onChange("contact", v)} />
    </div>
  </div>
);

type NumberInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

const NumberInput = ({ label, value, onChange }: NumberInputProps) => (
  <label className="block">
    <p className="text-xs uppercase tracking-[0.2em] text-foreground/70 font-semibold mb-1">
      {label}
    </p>
    <input
      type="tel"
      inputMode="numeric"
      pattern="[0-9]{10,15}"
      value={value === 0 ? "" : value}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
      required
      minLength={10}
      maxLength={15}
      className="w-full rounded-md border border-foreground/20 bg-background px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-fnblue/50"
    />
  </label>
);

const StatusLine = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "yellow" | "red" | "orange";
}) => {
  const toneClass = {
    blue: "border-fnblue/35 bg-fnblue/10 text-fnblue",
    green: "border-fngreen/35 bg-fngreen/10 text-fngreen",
    yellow: "border-fnyellow/45 bg-fnyellow/20 text-fnyellow",
    red: "border-fnred/35 bg-fnred/10 text-fnred",
    orange: "border-fnorange/35 bg-fnorange/10 text-fnorange",
  }[tone];

  return (
    <div
      className={`flex items-center justify-between rounded-md border px-3 py-2 ${toneClass}`}
    >
      <p className="text-xs uppercase tracking-[0.18em] font-semibold">
        {label}
      </p>
      <p className="text-sm font-black">{value}</p>
    </div>
  );
};

export default Register;
