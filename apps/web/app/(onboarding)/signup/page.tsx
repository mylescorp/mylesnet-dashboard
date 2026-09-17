import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { SIGNUP_COOKIE_NAME } from "@/lib/signup/cookies";
import SignupWizard from "@/signup/components/SignupWizard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign up for MylesNet",
  description:
    "Create your MylesNet workspace — customers, packages, payments, and network operations for connection businesses in one place.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  const cookieStore = await cookies();
  const initialToken = cookieStore.get(SIGNUP_COOKIE_NAME)?.value ?? null;
  return <SignupWizard initialToken={initialToken} />;
}