import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/features/auth/components/LogoutButton";

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome to AcadLab</h1>
            <p className="text-muted-foreground">
              Logged in as <strong>{session.user?.name}</strong> ({session.user?.email})
            </p>
            <p className="text-sm text-muted-foreground">
              Role: <span className="font-semibold">{session.user?.role}</span>
            </p>
          </div>
          <LogoutButton />
        </div>

        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Dashboard</h2>
          <p className="text-muted-foreground">
            This is a protected page. Only authenticated users can access this content.
          </p>
        </div>
      </div>
    </div>
  );
}
