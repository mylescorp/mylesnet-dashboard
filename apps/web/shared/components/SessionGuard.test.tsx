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

const SHORT_POLICY: PlatformSessionPolicy = {
  inactivityMs: 30_000,
  warningMs: 25_000,
  absoluteMs: 12 * 60 * 60 * 1000,
};

const START = 1_800_000_000_000;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  mockSessionId = "sess_test";
  mockSignOut.mockReset();
  mockSignOut.mockResolvedValue(undefined);
  window.localStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

function renderGuard(
  policy: PlatformSessionPolicy = SHORT_POLICY,
  sessionStartedAtMs: number | null = START,
) {
  return render(
    <SessionGuard sessionStartedAtMs={sessionStartedAtMs} policy={policy} pollIntervalMs={5_000} />,
  );
}

function advance(ms: number) {
  act(() => {
    jest.advanceTimersByTime(ms);
  });
}

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

test("an expired session offers a sign-in action", () => {
  renderGuard();
  advance(30_000);
  expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/signin");
});

test("activity shared from another tab keeps this tab signed in", () => {
  renderGuard();
  advance(20_000);

  // Simulate a second tab recording activity at the current instant.
  act(() => {
    window.localStorage.setItem(platformSessionActivityKey("sess_test"), String(START + 20_000));
  });
  advance(10_000);

  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test("the 12-hour cap ends the session even while the user is active", () => {
  const policy: PlatformSessionPolicy = { ...SHORT_POLICY, absoluteMs: 40_000 };
  renderGuard(policy);

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
