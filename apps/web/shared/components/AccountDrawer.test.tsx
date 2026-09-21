import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AccountDrawer } from "./AccountDrawer";

const mockSignOut = jest.fn();

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  _id: "u_test",
  name: "Ada Lovelace",
  email: "ada@mylesnet.test",
  phone: "+256 700 000 000",
  image: undefined,
  avatarStorageId: null,
  jobTitle: "Ops",
  platformRole: null,
  isPlatform: false,
  roles: [{ _id: "r1", slug: "agent", name: "Agent", isPlatform: false }],
  permissions: ["dashboard:access"],
  primaryRole: { slug: "agent", name: "Agent", isPlatform: false },
  canViewRevenue: false,
  ...overrides,
});

let currentUser: ReturnType<typeof makeUser> | null | undefined;

jest.mock("./UserProfileContext", () => ({
  useUserProfile: () => ({ user: currentUser, isLoading: currentUser === undefined, updateProfile: jest.fn() }),
}));

jest.mock("./UserProfileModal", () => ({
  UserProfileModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div role="dialog" aria-modal="true" aria-labelledby="profile-modal-title" data-testid="profile-modal">
        <h2 id="profile-modal-title">User Profile & Role Access</h2>
      </div>
    ) : null,
}));

jest.mock("@workos-inc/authkit-nextjs/components", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}), { virtual: true });

jest.mock("@mylesnet/ui", () => ({
  ConfirmDialog: ({
    open,
    onClose,
    onConfirm,
    confirmLabel,
  }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    confirmLabel?: string;
  }) =>
    open ? (
      <div role="dialog" aria-label="Sign out of MylesNet?">
        <button onClick={onClose}>Cancel</button>
        <button onClick={onConfirm}>{confirmLabel ?? "Confirm"}</button>
      </div>
    ) : null,
}));

beforeEach(() => {
  currentUser = makeUser();
  mockSignOut.mockReset();
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query: string) => ({
      matches: query.includes("min-width: 980px") ? true : false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

describe("AccountDrawer", () => {
  it("shows the trigger and opens the menu on click", async () => {
    render(<AccountDrawer />);
    const trigger = screen.getByRole("button", { name: /ada lovelace/i });
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("ada@mylesnet.test")).toBeInTheDocument();
  });

  it("does not duplicate platform administration links from the sidebar", async () => {
    currentUser = makeUser({ isPlatform: true });
    const { unmount } = render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.queryByTestId("acw-platform-section")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /tenants/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /feature flags/i })).not.toBeInTheDocument();
    unmount();

    currentUser = makeUser({ isPlatform: false });
    render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.queryByTestId("acw-platform-section")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the trigger", async () => {
    render(<AccountDrawer />);
    const trigger = screen.getByRole("button", { name: /ada lovelace/i });
    // Real browsers move focus to a button on click; jsdom doesn't, so focus it
    // explicitly so the drawer can restore focus to the trigger on close.
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByTestId("acw-panel")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("shows an offline banner when navigator reports offline", async () => {
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-offline")).toBeInTheDocument());
  });

  it("wires the theme segmented control to the shared theme mechanism", async () => {
    render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-theme")).toBeInTheDocument());
    const dark = screen.getByTestId("acw-theme-dark");
    fireEvent.click(dark);
    expect(window.localStorage.getItem("mylesnet-dashboard-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("signs out through the WorkOS signOut action after confirming", async () => {
    render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    // The confirm dialog's button inherits the same label; pick the one inside the dialog.
    const dialog = screen.getByRole("dialog", { name: /sign out of mylesnet/i });
    fireEvent.click(dialog.querySelector("button:last-of-type")!);
    await waitFor(() =>
      expect(mockSignOut).toHaveBeenCalledWith({ returnTo: expect.stringMatching(/^http/) }),
    );
  });

  it("opens the profile editor from the Profile & photo item", async () => {
    render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /profile & photo/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: /user profile & role access/i })).toBeInTheDocument());
  });

  it("keeps workspace settings in the account menu", async () => {
    render(<AccountDrawer />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("does not reveal access controls without the matching RBAC permission", async () => {
    currentUser = makeUser({ isPlatform: true, permissions: ["dashboard:access"] });
    render(<AccountDrawer panel="platform" />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /team & access/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/platform/settings");
  });

  it("shows permitted account controls in the platform drawer", async () => {
    currentUser = makeUser({ isPlatform: true, permissions: ["users:read", "audit_log:read"] });
    render(<AccountDrawer panel="platform" />);
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /team & access/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /audit log/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /security/i })).toBeInTheDocument();
  });

  it("uses a trusted Convex Storage avatar in every drawer identity surface", async () => {
    currentUser = makeUser({
      image: "https://brief-otter-123.convex.cloud/api/storage/avatar.png",
      avatarStorageId: "kg2avatar",
    });
    render(<AccountDrawer />);
    expect(screen.getByRole("button", { name: /ada lovelace/i }).querySelector("img")).toHaveAttribute(
      "src",
      expect.stringContaining(".convex.cloud/"),
    );
    fireEvent.click(screen.getByRole("button", { name: /ada lovelace/i }));
    await waitFor(() => expect(screen.getByTestId("acw-panel")).toBeInTheDocument());
    expect(screen.getByTestId("acw-panel").querySelector(".acw-header-avatar img")).toHaveAttribute(
      "src",
      expect.stringContaining(".convex.cloud/"),
    );
  });
});

