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

const getProblemStatementLockCallCount = () => {
  const fetchMock = global.fetch as unknown as {
    mock: { calls: Array<[RequestInfo | URL]> };
  };

  return fetchMock.mock.calls.filter(
    ([input]) =>
      typeof input === "string" && input === "/api/problem-statements/lock",
  ).length;
};

const addValidSrmMember = async (
  user: ReturnType<typeof userEvent.setup>,
  member: {
    contact: string;
    dept: string;
    name: string;
    netId: string;
    raNumber: string;
  },
) => {
  await user.type(screen.getAllByLabelText(/^Name$/i)[1], member.name);
  await user.type(
    screen.getAllByLabelText(/Registration Number/i)[1],
    member.raNumber,
  );
  await user.type(screen.getAllByLabelText(/^NetID$/i)[1], member.netId);
  await user.type(screen.getAllByLabelText(/Department/i)[1], member.dept);
  await user.type(screen.getAllByLabelText(/Contact/i)[1], member.contact);
  await user.click(screen.getByRole("button", { name: /add member/i }));
};

const addValidNonSrmMember = async (
  user: ReturnType<typeof userEvent.setup>,
  member: {
    collegeEmail: string;
    collegeId: string;
    contact: string;
    name: string;
  },
) => {
  await user.type(screen.getAllByLabelText(/^Name$/i)[1], member.name);
  await user.type(
    screen.getAllByLabelText(/College ID Number/i)[1],
    member.collegeId,
  );
  await user.type(
    screen.getAllByLabelText(/College Email \/ Personal Email/i)[1],
    member.collegeEmail,
  );
  await user.type(screen.getAllByLabelText(/Contact/i)[1], member.contact);
  await user.click(screen.getByRole("button", { name: /add member/i }));
};

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
                id: "ps-01",
                isFull: false,
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

  it("keeps next button enabled and shows validation guidance before minimum team size is met", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    const nextButton = await screen.findByRole("button", {
      name: /next/i,
    });

    expect(nextButton).toBeEnabled();
    await user.click(nextButton);
    expect(nextButton).toBeEnabled();
    expect(screen.getByText(/fix these to continue/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/single lock per onboarding draft/i),
    ).not.toBeInTheDocument();
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
    expect(screen.queryByText(/current cap/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/remaining/i)).not.toBeInTheDocument();
  });

  it("shows confirmation before locking a problem statement", async () => {
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
    await user.click(screen.getByRole("button", { name: /next/i }));

    const lockCallCountBefore = getProblemStatementLockCallCount();
    await user.click(
      await screen.findByRole("button", { name: /lock problem statement/i }),
    );

    expect(
      screen.getByText(/this action cannot be reverted/i),
    ).toBeInTheDocument();
    expect(getProblemStatementLockCallCount()).toBe(lockCallCountBefore);

    await user.click(screen.getByRole("button", { name: /continue/i }));
    await user.type(
      screen.getByPlaceholderText(/lock campus mobility optimizer/i),
      "lock campus mobility optimizer",
    );
    await user.click(
      screen.getByRole("button", { name: /yes, lock statement/i }),
    );
    expect(getProblemStatementLockCallCount()).toBe(lockCallCountBefore + 1);
  });

  it("keeps users on step 1 with inline lead errors when lead data is invalid", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByLabelText(/Team Name/i), "Board Breakers");
    await addValidSrmMember(user, {
      contact: "9876543211",
      dept: "ECE",
      name: "Member One",
      netId: "cd5678",
      raNumber: "RA1234567890124",
    });
    await addValidSrmMember(user, {
      contact: "9876543212",
      dept: "MECH",
      name: "Member Two",
      netId: "ef9012",
      raNumber: "RA1234567890125",
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      screen.queryByText(/single lock per onboarding draft/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Lead details are incomplete or invalid\. Fix highlighted lead fields to continue\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    const leadNameInput = document.getElementById(
      "register-step1-lead-srm-name",
    );
    expect(leadNameInput).toHaveAttribute("aria-invalid", "true");
  });

  it("allows recovering from invalid lead details and proceeds after correction", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.type(screen.getByLabelText(/Team Name/i), "Board Breakers");
    await addValidSrmMember(user, {
      contact: "9876543211",
      dept: "ECE",
      name: "Member One",
      netId: "cd5678",
      raNumber: "RA1234567890124",
    });
    await addValidSrmMember(user, {
      contact: "9876543212",
      dept: "MECH",
      name: "Member Two",
      netId: "ef9012",
      raNumber: "RA1234567890125",
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    const leadNameInput = document.getElementById(
      "register-step1-lead-srm-name",
    ) as HTMLInputElement;
    const leadRaNumberInput = document.getElementById(
      "register-step1-lead-srm-ra-number",
    ) as HTMLInputElement;
    const leadNetIdInput = document.getElementById(
      "register-step1-lead-srm-net-id",
    ) as HTMLInputElement;
    const leadDeptInput = document.getElementById(
      "register-step1-lead-srm-dept",
    ) as HTMLInputElement;
    const leadContactInput = document.getElementById(
      "register-step1-lead-srm-contact",
    ) as HTMLInputElement;

    await user.type(leadNameInput, "Lead One");
    await user.type(leadRaNumberInput, "RA1234567890123");
    await user.type(leadNetIdInput, "gh3456");
    await user.type(leadDeptInput, "CSE");
    await user.type(leadContactInput, "9876543210");

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByText(/single lock per onboarding draft/i),
    ).toBeInTheDocument();
  });

  it("focuses the first invalid field when submitting step 1", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    const nextButton = await screen.findByRole("button", { name: /next/i });
    await user.click(nextButton);

    expect(screen.getByLabelText(/Team Name/i)).toHaveFocus();
  });

  it("shows non-SRM validation blockers with the same smooth guidance flow", async () => {
    const user = userEvent.setup();
    render(<RegisterClient />);

    await user.click(screen.getByRole("button", { name: /^non-srm$/i }));
    await user.type(screen.getByLabelText(/Team Name/i), "Pitch Panthers");
    await user.click(screen.getByRole("checkbox"));

    const leadName = screen.getAllByLabelText(/^Name$/i)[0];
    const leadCollegeId = screen.getAllByLabelText(/College ID Number/i)[0];
    const leadCollegeEmail = screen.getAllByLabelText(
      /College Email \/ Personal Email/i,
    )[0];
    const leadContact = screen.getAllByLabelText(/Contact/i)[0];

    await user.type(leadName, "Lead Two");
    await user.type(leadCollegeId, "NID123");
    await user.type(leadCollegeEmail, "lead@abc.edu");
    await user.type(leadContact, "8765432109");

    await addValidNonSrmMember(user, {
      collegeEmail: "a@abc.edu",
      collegeId: "NID124",
      contact: "8765432108",
      name: "Member A",
    });
    await addValidNonSrmMember(user, {
      collegeEmail: "b@abc.edu",
      collegeId: "NID125",
      contact: "8765432107",
      name: "Member B",
    });

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      screen.queryByText(/single lock per onboarding draft/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/college name is required\./i).length).toBe(2);
    expect(
      screen.getAllByText(
        /club name is required when this team represents a club\./i,
      ).length,
    ).toBe(2);
    expect(screen.getByText(/fix these to continue/i)).toBeInTheDocument();
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
