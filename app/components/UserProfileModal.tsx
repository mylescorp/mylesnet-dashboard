"use client";

import { useRef, useState } from "react";
import { useAction } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { useUserProfile } from "./UserProfileContext";
import { Check, ImagePlus, ShieldCheck, Trash2, User, X } from "lucide-react";

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { user, updateProfile } = useUserProfile();
  const generateUploadUrl = useAction(api.profile.generateAvatarUploadUrl);
  const saveAvatar = useAction(api.profile.saveAvatar);
  const removeAvatar = useAction(api.profile.removeAvatar);

  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || "");
  const [avatarPreview, setAvatarPreview] = useState<{ objectUrl: string; storageId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen || !user) return null;

  const rawRole = user.primaryRole?.slug ?? user.platformRole ?? "operator";
  const formattedRole = rawRole.replace("platform_", "").replace(/_/g, " ").toUpperCase();
  const roleNames = (user.roles ?? []).map((role) => role.name);

  const setError = (text: string) => setStatusMessage({ type: "error", text });

  const handleAvatarSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      setError("Avatars must be a JPG, PNG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError("Avatars must be 5 MB or smaller.");
      return;
    }

    setUploadingAvatar(true);
    setStatusMessage(null);
    try {
      const { uploadUrl } = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as { storageId: string };
      await saveAvatar({ storageId });
      setAvatarPreview({ objectUrl: URL.createObjectURL(file), storageId });
      setStatusMessage({ type: "success", text: "Profile photo updated." });
    } catch {
      setError("We could not upload your profile photo. Please try again.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setRemovingAvatar(true);
    setStatusMessage(null);
    try {
      await removeAvatar();
      setAvatarPreview(null);
      setStatusMessage({ type: "success", text: "Profile photo removed." });
    } catch {
      setError("We could not remove your profile photo. Please try again.");
    } finally {
      setRemovingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      if (!name.trim() || !phone.trim()) {
        setError("Enter your full name and phone number before saving.");
        return;
      }
      await updateProfile({ name, phone, jobTitle });
      setStatusMessage({ type: "success", text: "Your profile has been saved." });
      setTimeout(() => {
        setStatusMessage(null);
        onClose();
      }, 1000);
    } catch {
      setError("We could not save your profile. Please try again.");
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
              {(avatarPreview?.objectUrl || user.image) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview?.objectUrl || user.image}
                  alt={name || "User Avatar"}
                  className="avatar-img"
                />
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

            <div className="avatar-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="avatar-file-input"
                onChange={handleAvatarSelected}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="avatar-action-button"
              >
                <ImagePlus size={14} />
                <span>{uploadingAvatar ? "Uploading…" : avatarPreview || user.image ? "Change photo" : "Add photo"}</span>
              </button>
              {(avatarPreview?.storageId || user.image) && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={removingAvatar}
                  className="avatar-action-button"
                >
                  <Trash2 size={14} />
                  <span>{removingAvatar ? "Removing…" : "Remove"}</span>
                </button>
              )}
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

          {/* Role access summary */}
          <div className="rbac-access-summary">
            <p className="rbac-summary-label">Your roles & access</p>
            {roleNames.length > 0 ? (
              <div className="rbac-role-tags">
                {roleNames.map((roleName) => (
                  <span key={roleName} className="rbac-role-tag">
                    {roleName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="rbac-summary-empty">No roles assigned yet — access is limited to sign-in.</p>
            )}
            <p className="rbac-perm-count">
              {user.permissions?.length ?? 0} permission{(user.permissions?.length ?? 0) === 1 ? "" : "s"} granted
            </p>
          </div>

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
