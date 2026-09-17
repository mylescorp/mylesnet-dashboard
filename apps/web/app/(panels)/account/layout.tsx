import { requireUser } from "@/shared/auth/session";

/** Direct account visits must have an authenticated session before redirecting. */
export default async function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireUser();
  return children;
}
