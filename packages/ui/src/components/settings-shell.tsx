import type { ReactNode } from "react";
import { cn } from "../utils";
import { isRouteActive, type NavItem } from "../navigation/nav";
import { PageHeader } from "./page-header";

export interface SettingsShellProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  nav: NavItem[];
  pathname: string;
  children: ReactNode;
  className?: string;
}

/** Two-tier settings layout: page header, secondary nav, content column. */
export function SettingsShell({ eyebrow, title, description, actions, nav, pathname, children, className }: SettingsShellProps) {
  return (
    <div className="workspace-page">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      <div className={cn("mn-settings", className)}>
        <nav className="mn-settings-nav" aria-label="Settings sections">
          {nav.map((item) => {
            const active = isRouteActive(pathname, item);
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={cn("mn-settings-link", active && "mn-settings-link-active")}
                aria-current={active ? "page" : undefined}
              >
                {Icon != null ? <Icon size={16} aria-hidden="true" /> : null}
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>
        <div className="mn-settings-content">{children}</div>
      </div>
    </div>
  );
}