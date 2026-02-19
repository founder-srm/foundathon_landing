import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RegisterClient from "./register-client";

const mocks = vi.hoisted(() => ({
  getAuthUiState: vi.fn(),
  push: vi.fn(),
  redirect: vi.fn(),
  routeProgressStart: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/auth-ui-state", () => ({
  getAuthUiState: mocks.getAuthUiState,
}));

vi.mock("@/components/ui/route-progress", () => ({
  useRouteProgress: () => ({
    isPending: false,
    start: mocks.routeProgressStart,
    stop: vi.fn(),
  }),
}));

describe("Register page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthUiState.mockResolvedValue({
      isSignedIn: true,
      teamId: null,
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      if (typeof input === "string" && input === "/api/problem-statements") {
        return new Response(
          JSON.stringify({
            statements: [
              {
                cap: 10,
                id: "ps-01",
                isFull: false,
                registeredCount: 2,
                remaining: 8,
                summary: "Summary",
                title: "Campus Mobility Optimizer",
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({}), { status: 200 });
    }) as typeof fetch;
  });

  it("renders onboarding with Team Name field", async () => {
    render(<RegisterClient />);

    expect(await screen.findByText(/onboarding wizard/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Team Name/i)).toBeInTheDocument();
  });

  it("keeps next button disabled before minimum team size is met", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    const nextButton = await screen.findByRole("button", {
      name: /next/i,
    });

    expect(nextButton).toBeDisabled();
    await user.click(nextButton);
    expect(nextButton).toBeDisabled();
  });

  it("moves to problem statement step after valid team details", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByLabelText(/Team Name/i), "Board Breakers");

    const nameInputs = screen.getAllByLabelText(/^Name$/i);
    const raInputs = screen.getAllByLabelText(/Registration Number/i);
    const netIdInputs = screen.getAllByLabelText(/^NetID$/i);
    const deptInputs = screen.getAllByLabelText(/Department/i);
    const contactInputs = screen.getAllByLabelText(/Contact/i);

    await user.type(nameInputs[0], "Lead One");
    await user.type(raInputs[0], "RA1234567890123");
    await user.type(netIdInputs[0], "ab1234");
    await user.type(deptInputs[0], "CSE");
    await user.type(contactInputs[0], "9876543210");

    await user.type(nameInputs[1], "Member One");
    await user.type(raInputs[1], "RA1234567890124");
    await user.type(netIdInputs[1], "cd5678");
    await user.type(deptInputs[1], "ECE");
    await user.type(contactInputs[1], "9876543211");

    await user.click(screen.getByRole("button", { name: /add member/i }));

    await user.type(screen.getAllByLabelText(/^Name$/i)[1], "Member Two");
    await user.type(
      screen.getAllByLabelText(/Registration Number/i)[1],
      "RA1234567890125",
    );
    await user.type(screen.getAllByLabelText(/^NetID$/i)[1], "ef9012");
    await user.type(screen.getAllByLabelText(/Department/i)[1], "MECH");
    await user.type(screen.getAllByLabelText(/Contact/i)[1], "9876543212");

    await user.click(screen.getByRole("button", { name: /add member/i }));

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeEnabled();

    await user.click(nextButton);

    expect(
      await screen.findByText(/single lock per onboarding draft/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Campus Mobility Optimizer/i)).toBeInTheDocument();
  });

  it("register page redirects signed-out users to login", async () => {
    mocks.getAuthUiState.mockResolvedValueOnce({
      isSignedIn: false,
      teamId: null,
    });

    const { default: RegisterPage } = await import("./page");
    await RegisterPage();

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/api/auth/login?next=%2Fregister",
    );
  });

  it("register page redirects existing teams to dashboard", async () => {
    mocks.getAuthUiState.mockResolvedValueOnce({
      isSignedIn: true,
      teamId: "11111111-1111-4111-8111-111111111111",
    });

    const { default: RegisterPage } = await import("./page");
    await RegisterPage();

    expect(mocks.redirect).toHaveBeenCalledWith(
      "/dashboard/11111111-1111-4111-8111-111111111111",
    );
  });
});
