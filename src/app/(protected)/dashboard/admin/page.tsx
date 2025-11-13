import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Saúde do sistema",
};

export default function LegacyAdminDashboardPage() {
  redirect("/system-health");
}
