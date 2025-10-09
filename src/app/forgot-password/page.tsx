"use client";

import { useState } from "react";
import { ForgotPasswordForm } from "@/features/auth";
import { ForgotPasswordData } from "@/features/auth";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (data: ForgotPasswordData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log("Password reset response:", result.message);
    } catch (err) {
      console.error("Forgot password error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ForgotPasswordForm onSubmit={handleForgotPassword} isLoading={isLoading} />
    </div>
  );
}
