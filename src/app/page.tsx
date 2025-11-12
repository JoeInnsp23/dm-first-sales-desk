import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

// Disable static generation for pages using auth
export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getAuthContext();

  if (auth) {
    redirect("/dashboard" as any);
  } else {
    redirect("/sign-in" as any);
  }
}
