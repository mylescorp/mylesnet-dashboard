import Link from "next/link";
import { PublicConvexProvider } from "@/signup/components/PublicConvexProvider";
import "@/signup/signup.css";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicConvexProvider>
      <div className="signup-shell">
        <header className="signup-header">
          <Link className="signup-header-brand" href="/">
            MylesNet
          </Link>
          <Link className="signup-header-signin" href="/signin">
            Sign in
          </Link>
        </header>
        <main className="signup-main">{children}</main>
        <footer className="signup-footer">
          <span>Powered by MylesCorp Technologies Ltd</span>
          <span className="signup-footer-sep" aria-hidden="true">
            ·
          </span>
          <span>© {new Date().getFullYear()} MylesNet</span>
        </footer>
      </div>
    </PublicConvexProvider>
  );
}