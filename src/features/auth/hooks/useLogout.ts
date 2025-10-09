"use client";

import { useCallback } from "react";
import { signOut } from "next-auth/react";

/**
 * Hook for handling logout functionality using NextAuth
 */
export function useLogout() {
  const logout = useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  return { logout };
}
