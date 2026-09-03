"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { PlatformUser } from "./UserProfileDropdown";

interface UserProfileContextType {
  user: PlatformUser | null | undefined;
  isLoading: boolean;
  updateProfile: (data: { name?: string; phone?: string; image?: string }) => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType>({
  user: undefined,
  isLoading: true,
  updateProfile: async () => {},
});

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const user = useQuery(api.platform.getCurrentPlatformUser) as PlatformUser | null | undefined;
  const updateProfileMutation = useMutation(api.platformUsers.updateUserProfile);

  const updateProfile = async (data: { name?: string; phone?: string; image?: string }) => {
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
