import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import ContabiliumClient from "./ContabiliumClient";

export default async function ContabiliumPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Solo admins
  if (session.user.rol !== "admin") redirect("/");

  return <ContabiliumClient />;
}
