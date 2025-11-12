import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

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

  return <>{children}</>;
}
