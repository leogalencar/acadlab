# Authentication Setup

This project uses **NextAuth.js v5** for authentication with credentials provider and session management.

## Overview

The authentication system provides:
- **Session-based authentication** using JWT tokens
- **Protected routes** via middleware
- **Role-based access control** (PROFESSOR, TECHNICIAN, ADMINISTRATOR)
- **Secure password hashing** with bcryptjs
- **Automatic login/logout** flow

## Setup

### 1. Environment Configuration

Ensure your `.env` file contains the NextAuth configuration:

```env
NEXTAUTH_SECRET="your-generated-secret-key"
NEXTAUTH_URL="http://localhost:3000"
```

Generate a secure secret key:

```bash
openssl rand -base64 32
```

### 2. Database Setup

The authentication system requires the following database tables:
- `users` - User accounts with credentials
- `accounts` - OAuth provider accounts (for future use)
- `sessions` - Active user sessions
- `verification_tokens` - Email verification tokens (for future use)

Run the database migration:

```bash
npm run db:push
npm run db:seed  # Creates test users
```

## Usage

### Login

Users can log in at `/login` with their email and password. The system:
1. Validates credentials against the database
2. Verifies password hash using bcrypt
3. Creates a JWT session token
4. Redirects to the home page

### Logout

Users can log out using the `LogoutButton` component or the `useLogout` hook:

```tsx
import { useLogout } from "@/features/auth";

const { logout } = useLogout();
// Call logout() to sign out
```

### Protected Routes

All routes except `/login` and `/forgot-password` are automatically protected by the middleware. Unauthenticated users are redirected to the login page.

### Accessing Session Data

**Server Components:**

```tsx
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();
  
  if (!session) {
    redirect("/login");
  }

  return <div>Welcome, {session.user.name}!</div>;
}
```

**Client Components:**

```tsx
"use client";
import { useSession } from "next-auth/react";

export default function Component() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;

  return <div>Welcome, {session.user.name}!</div>;
}
```

### User Roles

Each user has a role that determines their permissions:
- **PROFESSOR**: Base level access
- **TECHNICIAN**: Professor permissions + lab management
- **ADMINISTRATOR**: Full system access

Access the user's role from the session:

```tsx
const session = await auth();
const userRole = session?.user?.role; // "PROFESSOR" | "TECHNICIAN" | "ADMINISTRATOR"
```

## Test Users

After running `npm run db:seed`, you can log in with:

| Email                      | Password    | Role           |
|----------------------------|-------------|----------------|
| professor@acadlab.com      | password123 | PROFESSOR      |
| technician@acadlab.com     | password123 | TECHNICIAN     |
| admin@acadlab.com          | password123 | ADMINISTRATOR  |

## File Structure

```
src/
├── lib/
│   └── auth.ts                    # NextAuth configuration
├── app/
│   ├── api/auth/[...nextauth]/
│   │   └── route.ts               # NextAuth API routes
│   ├── login/
│   │   └── page.tsx               # Login page
│   └── layout.tsx                 # Root layout with AuthProvider
├── features/auth/
│   ├── components/
│   │   ├── LoginForm.tsx          # Login form component
│   │   ├── ForgotPasswordForm.tsx # Password recovery form
│   │   └── LogoutButton.tsx       # Logout button
│   ├── hooks/
│   │   └── useLogout.ts           # Logout hook
│   ├── types/
│   │   └── index.ts               # Auth type definitions
│   └── utils/
│       └── validation.ts          # Validation utilities
├── components/
│   └── AuthProvider.tsx           # SessionProvider wrapper
├── middleware.ts                  # Route protection middleware
└── types/
    └── next-auth.d.ts             # NextAuth type extensions
```

## Security Notes

1. **Password Hashing**: All passwords are hashed using bcryptjs with salt rounds
2. **Session Tokens**: JWT tokens are signed with the NEXTAUTH_SECRET
3. **HTTPS**: Use HTTPS in production (configure NEXTAUTH_URL accordingly)
4. **Secret Rotation**: Rotate NEXTAUTH_SECRET periodically
5. **Environment Variables**: Never commit `.env` to version control

## Future Enhancements

- Email verification for new accounts
- Password reset via email
- OAuth providers (Google, GitHub, etc.)
- Two-factor authentication (2FA)
- Session expiration and refresh tokens
- Account lockout after failed login attempts
