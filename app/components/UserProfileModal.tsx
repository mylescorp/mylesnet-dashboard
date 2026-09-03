"use client";

import { useState } from "react";
import { useUserProfile } from "./UserProfileContext";
import { Check, ShieldCheck, User, X } from "lucide-react";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, updateProfile } = useUserProfile();

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen || !user) return null;

  const rawRole = user.platformRole ? String(user.platformRole) : "operator";
  const formattedRole = rawRole.replace("platform_", "").replace(/_/g, " ").toUpperCase();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      if (!name.trim() || !phone.trim()) {
        setStatusMessage({ type: "error", text: "Enter your full name and phone number before saving." });
        return;
      }
      await updateProfile({ name, phone, jobTitle });
      setStatusMessage({ type: "success", text: "Your profile has been saved." });
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1000);
    } catch {
      setStatusMessage({
        type: "error",
        text: "We could not save your profile. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const initials = (name || user.email || "User")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="profile-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="profile-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Header */}
        <div className="profile-modal-header">
          <div>
            <p className="eyebrow">Account Settings & RBAC</p>
            <h2 id="profile-modal-title" className="page-title" style={{ fontSize: 20 }}>
              User Profile & Role Access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="profile-modal-close"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSave} className="profile-modal-body">
          {/* Avatar & Role Card Lockup */}
          <div className="profile-badge-card">
            <div className="profile-badge-avatar">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt={name || "User Avatar"} className="avatar-img" />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="profile-badge-details">
              <strong className="profile-badge-name">{name || user.email}</strong>
              <small className="profile-badge-email">{user.email}</small>

              <div className="rbac-role-pill-badge" title="Role-Based Access Control Tier">
                <ShieldCheck size={13} />
                <span>RBAC: {formattedRole}</span>
              </div>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`profile-status-alert ${
                statusMessage.type === "success" ? "alert-success" : "alert-error"
              }`}
            >
              {statusMessage.type === "success" && <Check size={16} />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Form Primitives */}
          <div className="pf-stack">
            <div className="pf-field">
              <label htmlFor="user-name-input" className="pf-label">
                Full Name
              </label>
              <input
                id="user-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="pf-input"
              />
            </div>

            <div className="pf-field">
              <label htmlFor="user-title-input" className="pf-label">
                Job Title
              </label>
              <input
                id="user-title-input"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                maxLength={100}
                className="pf-input"
              />
            </div>

            <div className="pf-field">
              <label htmlFor="user-phone-input" className="pf-label">
                Phone Number
              </label>
              <input
                id="user-phone-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+256 700 000 000"
                className="pf-input"
              />
            </div>

            <div className="pf-field">
              <label htmlFor="user-email-static" className="pf-label">
                Email Address (Verified Identity)
              </label>
              <input
                id="user-email-static"
                type="email"
                value={user.email || ""}
                disabled
                className="pf-input input-disabled"
              />
              <span className="pf-hint">WorkOS single sign-on identity. Contact owner to change email.</span>
            </div>

          </div>

          {/* Actions */}
          <div className="profile-modal-actions">
            <button type="button" onClick={onClose} className="secondary-button">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="primary-button">
              <User size={16} />
              <span>{saving ? "Saving changes…" : "Save Profile"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
