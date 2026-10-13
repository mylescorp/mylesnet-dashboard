import { render, screen, fireEvent, act } from "@testing-library/react";
import { SessionGuard } from "./SessionGuard";
import type { PlatformSessionPolicy } from "@/lib/auth/sessionPolicy";
import { platformSessionActivityKey } from "@/lib/auth/sessionPolicy";

const mockSignOut = jest.fn();
let mockSessionId: string | undefined = "sess_test";

jest.mock(
  "@workos-inc/authkit-nextjs/components",
  () => ({
    useAuth: () => ({ sessionId: mockSessionId, signOut: mockSignOut }),
  }),
  { virtual: true },
);

const POLICY: PlatformSessionPolicy = {
  inactivityMs: 30_000,
  warningMs: 25_000,
  absoluteMs: 12 * 60 * 60 * 1000,
};

const START = new Date("2026-10-13T00:00:00Z").getTime();

function activityKey() {
  return platformSessionActivityKey("sess_test");
}

function storeActivity(at: number) {
  window.localStorage.setItem(activityKey(), String(at));
}

function renderGuard({
  policy = POLICY,
  pollIntervalMs = 5_000,
  sessionStartedAtMs = START,
}: {
  policy?: PlatformSessionPolicy;
  pollIntervalMs?: number;
  sessionStartedAtMs?: number | null;
} = {}) {
  return render(
    <SessionGuard
      sessionStartedAtMs={sessionStartedAtMs}
      policy={policy}
      pollIntervalMs={pollIntervalMs}
    />,
  );
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  window.localStorage.clear();
  mockSessionId = "sess_test";
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
});

test("stays quiet while the session is active", () => {
  renderGuard();
  expect(screen.queryByRole("alert")).toBeNull();
  advance(20_000);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test("warns after 25 minutes of inactivity and lets the user continue", () => {
  renderGuard();
  advance(25_000);

  const banner = screen.getByRole("alert");
  expect(banner).toHaveTextContent("Still working?");
  expect(banner).toHaveTextContent("About 1 minute left");

  fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test("ends the session after 30 minutes of inactivity", () => {
  renderGuard();
  advance(30_000);

  expect(screen.getByRole("alertdialog")).toHaveTextContent("Your session has ended");
  expect(mockSignOut).toHaveBeenCalledTimes(1);
  expect(mockSignOut).toHaveBeenCalledWith({ returnTo: "http://localhost/signin" });
});

test("an expired session is announced, focused, and offers a way to end it", () => {
  renderGuard();
  advance(30_000);

  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveAttribute("aria-modal", "true");

  const action = screen.getByRole("link", { name: "Sign in again" });
  expect(action).toHaveAttribute("href", "/sign-out");
  expect(document.activeElement).toBe(action);
});

test("a stale activity record ends the session on the next page load", () => {
  storeActivity(START - 31_000);
  renderGuard();

  expect(screen.getByRole("alertdialog")).toHaveTextContent("Your session has ended");
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test("returning to an idle tab ends the session instead of extending it", () => {
  // A long poll interval stands in for a background tab whose timers are
  // throttled: nothing runs until the user comes back.
  renderGuard({ pollIntervalMs: 600_000 });
  advance(31_000);
  expect(screen.queryByRole("alertdialog")).toBeNull();

  act(() => {
    fireEvent.pointerDown(window);
  });

  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test("a failed sign-out is retried and the notice still ends the session", async () => {
  mockSignOut.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  renderGuard();
  advance(30_000);
  await act(async () => {});

  expect(screen.getByRole("alertdialog")).toHaveTextContent("could not end this session");
  expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
    "href",
    "/sign-out",
  );
  expect(mockSignOut).toHaveBeenCalledTimes(1);

  advance(5_000);
  expect(mockSignOut).toHaveBeenCalledTimes(2);
});

test("activity shared from another tab keeps this tab signed in", () => {
  renderGuard();
  advance(20_000);

  // Simulate a second tab recording activity at the current instant.
  act(() => {
    storeActivity(START + 20_000);
  });
  advance(10_000);

  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test("the 12-hour cap ends the session even while the user is active", () => {
  renderGuard({ policy: { ...POLICY, absoluteMs: 40_000 } });

  for (let elapsed = 0; elapsed < 40_000; elapsed += 10_000) {
    advance(10_000);
    act(() => {
      fireEvent.pointerDown(window);
    });
  }

  expect(screen.getByRole("alertdialog")).toHaveTextContent("maximum session length");
  expect(mockSignOut).toHaveBeenCalledTimes(1);
});

test("does nothing until a platform session is available", () => {
  mockSessionId = undefined;
  renderGuard();
  advance(60_000);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});
