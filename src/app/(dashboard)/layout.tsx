import { requireAuth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAuth();
  } catch (error) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
