import { LoginCredentials, ForgotPasswordData } from "../types";

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 * Minimum 8 characters
 */
export function validatePassword(password: string): boolean {
  return password.length >= 8;
}

/**
 * Validate login credentials
 */
export function validateLoginCredentials(credentials: LoginCredentials): {
  isValid: boolean;
  errors: { email?: string; password?: string };
} {
  const errors: { email?: string; password?: string } = {};

  if (!credentials.email) {
    errors.email = "Email is required";
  } else if (!validateEmail(credentials.email)) {
    errors.email = "Invalid email format";
  }

  if (!credentials.password) {
    errors.password = "Password is required";
  } else if (!validatePassword(credentials.password)) {
    errors.password = "Password must be at least 8 characters";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validate forgot password data
 */
export function validateForgotPasswordData(data: ForgotPasswordData): {
  isValid: boolean;
  errors: { email?: string };
} {
  const errors: { email?: string } = {};

  if (!data.email) {
    errors.email = "Email is required";
  } else if (!validateEmail(data.email)) {
    errors.email = "Invalid email format";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
