import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterPage from "./page";

const pushMock = vi.fn();
const routeProgressStartMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock("@/components/ui/route-progress", () => ({
  useRouteProgress: () => ({
    isPending: false,
    start: routeProgressStartMock,
    stop: vi.fn(),
  }),
}));

describe("Register page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === "string" && input === "/api/register" && !init) {
          return new Response(JSON.stringify({ teams: [] }), { status: 200 });
        }
        return new Response(JSON.stringify({ teams: [] }), { status: 200 });
      },
    ) as typeof fetch;
  });

  it("shows loading status while saved teams are being fetched", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;

    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    ) as typeof fetch;

    render(<RegisterPage />);
    expect(
      screen.getByText(/syncing your saved registrations/i),
    ).toBeInTheDocument();

    resolveFetch?.(
      new Response(JSON.stringify({ teams: [] }), { status: 200 }),
    );
    expect(
      await screen.findByText(/saved registration status is up to date/i),
    ).toBeInTheDocument();
  });

  it("renders onboarding with Team Name field", async () => {
    render(<RegisterPage />);

    expect(await screen.findByText(/onboarding wizard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name/i)).toBeInTheDocument();
  });

  it("keeps create button disabled before minimum team size is met", async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    const createBtn = await screen.findByRole("button", {
      name: /create team/i,
    });

    expect(createBtn).toBeDisabled();
    await user.click(createBtn);
    expect(createBtn).toBeDisabled();
  });
});
