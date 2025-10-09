export interface User {
  id: string;
  name: string;
  email: string;
  role: "professor" | "technician" | "administrator";
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface ForgotPasswordData {
  email: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
