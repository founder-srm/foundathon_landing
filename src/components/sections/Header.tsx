import { getAuthUiState } from "@/lib/auth-ui-state";
import HeaderClient from "./HeaderClient";

const Header = async () => {
  const { isSignedIn, teamId } = await getAuthUiState();
  return <HeaderClient initialIsSignedIn={isSignedIn} initialTeamId={teamId} />;
};

export default Header;
