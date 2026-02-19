import { redirect } from "next/navigation";

type TeamPageParams = {
  params: Promise<{ teamId: string }>;
};

export default async function TeamPageRedirect({ params }: TeamPageParams) {
  const { teamId } = await params;
  redirect(`/dashboard/${teamId}`);
}
