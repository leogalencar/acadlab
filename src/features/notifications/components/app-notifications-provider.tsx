"use client";

import type { ReactNode } from "react";

import { ToastProvider, ToastViewport } from "@/features/notifications/components/toast-provider";

export function AppNotificationsProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ToastProvider>
      {children}
      <ToastViewport />
    </ToastProvider>
  );
}
