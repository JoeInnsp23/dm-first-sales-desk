import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ErrorBoundary } from "@/components/error-boundary";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

// Disable static generation for authenticated pages
export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAuth();
  } catch (error) {
    redirect("/sign-in" as any);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardNav />
      <main className="flex-1">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
