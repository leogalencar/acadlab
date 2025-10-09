"use client";

import { ForgotPasswordForm } from "@/features/auth";
import { ForgotPasswordData } from "@/features/auth";

export default function ForgotPasswordPage() {
  const handleForgotPassword = (data: ForgotPasswordData) => {
    // TODO: Implement actual forgot password logic with backend
    // For now, just log the email
    console.log("Password reset requested for:", data.email);
    
    // This would typically make an API call to send a password reset email
    // Example:
    // const response = await fetch('/api/auth/forgot-password', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(data),
    // });
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <ForgotPasswordForm onSubmit={handleForgotPassword} />
    </div>
  );
}
