"use client";

import { LoginForm } from "@/features/auth";
import { LoginCredentials } from "@/features/auth";

export default function LoginPage() {
  const handleLogin = (credentials: LoginCredentials) => {
    // TODO: Implement actual login logic with backend
    // For now, just log the credentials
    console.log("Login attempt with:", { email: credentials.email });
    
    // This would typically make an API call to authenticate the user
    // Example:
    // const response = await fetch('/api/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(credentials),
    // });
    // 
    // if (response.ok) {
    //   // Redirect to dashboard or home
    //   router.push('/dashboard');
    // }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <LoginForm onSubmit={handleLogin} />
    </div>
  );
}
