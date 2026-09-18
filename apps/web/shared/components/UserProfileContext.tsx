"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
export interface PlatformUserRole {
  _id?: string;
  slug: string;
  name: string;
  isPlatform: boolean;
}

export type PlatformUser = {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  image?: string;
  avatarStorageId?: string | null;
  jobTitle?: string;
  platformRole: string | null;
  tenantRole?: string | null;
  tenantId?: string | null;
  isPlatform: boolean;
  roles: PlatformUserRole[];
  permissions: string[];
  primaryRole?: { slug: string; name: string; isPlatform: boolean } | null;
  canViewRevenue: boolean;
  mfaEnrolled: boolean;
};

interface UserProfileContextType {
  user: PlatformUser | null | undefined;
  isLoading: boolean;
  updateProfile: (data: { name?: string; phone?: string; jobTitle?: string }) => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  user: undefined,
  isLoading: true,
  updateProfile: async () => {},
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const user = useQuery(api.platform.getCurrentPlatformUser, {}) as PlatformUser | null | undefined;
  const updateProfileMutation = useMutation(api.platformUsers.updateUserProfile);

  const updateProfile = async (data: { name?: string; phone?: string; jobTitle?: string }) => {
    await updateProfileMutation(data);
  };

  return (
    <UserProfileContext.Provider
      value={{
        user,
        isLoading: user === undefined,
        updateProfile,
      }}
    >
      {children}
    </UserProfileContext.Provider>
  );
}

export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error("useUserProfile must be used within a UserProfileProvider");
  }
  return context;
}

