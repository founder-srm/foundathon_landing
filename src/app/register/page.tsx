import { redirect } from "next/navigation";
import { getAuthUiState } from "@/lib/auth-ui-state";
import RegisterClient from "./register-client";

export default async function RegisterPage() {
  const { isSignedIn, teamId } = await getAuthUiState();

  if (!isSignedIn) {
    redirect(`/api/auth/login?next=${encodeURIComponent("/register")}`);
  }

  if (teamId) {
    redirect(`/dashboard/${teamId}`);
  }

  return <RegisterClient />;
}
