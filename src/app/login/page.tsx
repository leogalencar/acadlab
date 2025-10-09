"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/features/auth";
import { LoginCredentials } from "@/features/auth";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Store user data (in a real app, you'd use a state management solution or session)
      console.log("Login successful:", data.user);
      
      // Redirect to home page or dashboard
      router.push("/");
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
        {error && (
          <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md text-center">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
