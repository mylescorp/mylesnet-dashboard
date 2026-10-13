import { fireEvent, render, screen } from "@testing-library/react";
import { LayoutDashboard } from "lucide-react";
import { AppShell, SidebarRail } from "@mylesnet/ui";
import type { NavGroup } from "@mylesnet/ui";

const groups: NavGroup[] = [{
  id: "overview",
  label: "Workspace",
  items: [{ href: "/dashboard", label: "Overview", icon: LayoutDashboard, badge: 8, badgeTone: "live" }],
}];

describe("shared navigation shell", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (media: string) => ({
        matches: media.includes("min-width: 1024px"), media, onchange: null,
        addEventListener: () => undefined, removeEventListener: () => undefined,
        addListener: () => undefined, removeListener: () => undefined, dispatchEvent: () => false,
      }),
    });
  });

  it("renders an active nav item and its live count", () => {
    render(<SidebarRail groups={groups} pathname="/dashboard" brand={{ name: "MylesNet", logo: "/brand.svg" }} collapsed={false} onToggleCollapsed={() => undefined} />);
    expect(screen.getByRole("link", { name: /overview/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("8")).toHaveClass("sidebar-count-live");
  });

  it("collapses the sidebar to the icon rail from its control", () => {
    render(
      <AppShell
        renderSidebar={(state) => <SidebarRail groups={groups} pathname="/dashboard" brand={{ name: "MylesNet", logo: "/brand.svg" }} collapsed={state.collapsed} onToggleCollapsed={state.onToggleCollapsed} />}
        topbar={() => <div />}
      >
        <div />
      </AppShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(document.querySelector(".sidebar.sidebar-collapsed")).toBeInTheDocument();
  });
});
