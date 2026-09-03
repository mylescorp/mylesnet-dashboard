"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  ArrowRightLeft,
  ChevronDown,
  LogOut,
  RadioTower,
  Settings2,
  ShieldCheck,
  ShieldPlus,
  User as UserIcon,
} from "lucide-react";
import { UserProfileModal } from "./UserProfileModal";
import { useUserProfile } from "./UserProfileContext";

export type PlatformUser = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  jobTitle?: string;
  platformRole: string | null;
  isPlatform: boolean;
};

interface UserProfileDropdownProps {
  user?: PlatformUser | null;
}

export function UserProfileDropdown({ user: propUser }: UserProfileDropdownProps = {}) {
  const { user: contextUser } = useUserProfile();
  const user = propUser !== undefined ? propUser : contextUser;

  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPlatformMode = pathname.startsWith("/platform");

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.replace("/signin");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  };

  const displayName = user?.name || user?.email?.split("@")[0] || "User";
  const displayEmail = user?.email || "Signed in";
  const rawRole = user?.platformRole ? String(user.platformRole) : "operator";
  const formattedRole = rawRole.replace("platform_", "").replace(/_/g, " ").toUpperCase();

  // Get initials for avatar badge
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className="user-profile-dropdown" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="user-avatar-btn"
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="User account menu"
          title={displayEmail}
        >
          <span className="user-avatar-circle">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={displayName} className="avatar-img-sm" />
            ) : (
              initials || <UserIcon size={16} />
            )}
          </span>
          <div className="user-avatar-info">
            <span className="user-avatar-name">{displayName}</span>
            <span className="user-avatar-role">{formattedRole}</span>
          </div>
          <ChevronDown size={14} className={`user-avatar-chevron ${isOpen ? "chevron-rotated" : ""}`} />
        </button>

        {isOpen && (
          <div className="profile-dropdown-card" role="menu">
            {/* Header Card Info */}
            <div className="profile-card-header">
              <div className="profile-header-avatar">
                {user?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.image} alt={displayName} className="avatar-img-md" />
                ) : (
                  initials
                )}
              </div>
              <div className="profile-header-text">
                <strong className="profile-header-name">{displayName}</strong>
                <small className="profile-header-email">{displayEmail}</small>
                <div className="profile-header-role-pill">RBAC: {formattedRole}</div>
              </div>
            </div>

            <div className="profile-dropdown-divider" />

            {/* Manage Profile & RBAC Action */}
            <div className="profile-dropdown-section">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  setIsModalOpen(true);
                }}
                className="profile-menu-item item-highlight"
              >
                <ShieldCheck size={16} />
                <div className="profile-item-text">
                  <span>Manage Profile</span>
                  <small>Edit your contact details and view access</small>
                </div>
              </button>
            </div>

            <div className="profile-dropdown-divider" />

            {/* Quick Workspace Switcher Item */}
            <div className="profile-dropdown-section">
              <p className="profile-section-label">Workspace Context</p>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  router.push(isPlatformMode ? "/dashboard" : "/platform");
                }}
                className="profile-menu-item"
              >
                {isPlatformMode ? <RadioTower size={16} /> : <ShieldPlus size={16} />}
                <div className="profile-item-text">
                  <span>{isPlatformMode ? "Switch to Network Ops" : "Switch to Control Panel"}</span>
                  <small>{isPlatformMode ? "Live router estate & incidents" : "Master Admin & field ops"}</small>
                </div>
                <ArrowRightLeft size={14} className="item-arrow" />
              </button>
            </div>

            <div className="profile-dropdown-divider" />

            {/* System Settings */}
            <div className="profile-dropdown-section">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  router.push(isPlatformMode ? "/platform/audit-log" : "/centipid");
                }}
                className="profile-menu-item"
              >
                <Settings2 size={16} />
                <span>{isPlatformMode ? "Audit Logs & System" : "Billing Integration"}</span>
              </button>
            </div>

            <div className="profile-dropdown-divider" />

            {/* Sign Out Button */}
            <div className="profile-dropdown-section">
              <button
                type="button"
                role="menuitem"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="profile-menu-item item-signout"
              >
                <LogOut size={16} />
                <span>{isSigningOut ? "Signing out…" : "Sign out"}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Profile Modal Dialog */}
      <UserProfileModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
