import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export default async function Home() {
  const auth = await getAuthContext();

  if (auth) {
    redirect("/dashboard");
  } else {
    redirect("/sign-in");
  }
}
