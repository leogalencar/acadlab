import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate input
    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent email enumeration
    // In a real implementation, you would:
    // 1. Generate a password reset token
    // 2. Store it in the database with expiration
    // 3. Send an email with the reset link
    
    if (user) {
      // TODO: Generate password reset token and send email
      console.log(`Password reset requested for user: ${user.email}`);
      // In production, send email with reset link here
    }

    return NextResponse.json(
      {
        message: "If an account exists with this email, you will receive password reset instructions",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An error occurred processing your request" },
      { status: 500 }
    );
  }
}
