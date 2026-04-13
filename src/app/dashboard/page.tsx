import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { decryptSession } from "@/server/auth/session";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("calroo_session");

  if (!sessionCookie?.value) {
    redirect("/");
  }

  const session = await decryptSession(sessionCookie.value, env.SESSION_SECRET);
  if (!session) {
    redirect("/");
  }

  return <DashboardClient session={session} />;
}
