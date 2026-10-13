import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "@mylesnet/ui/styles.css";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap" });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });

/**
 * Resolves the client-readable theme cookie before first paint. The server also
 * renders the selected mode on html so the page begins with the correct theme.
 */
const themeScript = `(function() {
  const storedCookie = document.cookie.split('; ').find((cookie) => cookie.startsWith('__mylesnet_theme='))?.split('=')[1];
  let stored = storedCookie === 'light' || storedCookie === 'dark' || storedCookie === 'system' ? storedCookie : undefined;
  if (!stored) {
    try {
      const legacy = localStorage.getItem('mylesnet-dashboard-theme');
      if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
        stored = legacy;
        document.cookie = '__mylesnet_theme=' + legacy + '; Path=/; Max-Age=31536000; Secure; SameSite=Lax';
        localStorage.removeItem('mylesnet-dashboard-theme');
      }
    } catch {}
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored === 'light' || stored === 'dark' ? stored : (prefersDark ? 'dark' : 'light');
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const storedTheme = (await cookies()).get("__mylesnet_theme")?.value;
  const theme = storedTheme === "light" || storedTheme === "dark" || storedTheme === "system" ? storedTheme : "system";
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={theme}
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable}`}
    >
      <body className="antialiased">
        {children}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeScript }}
        />
      </body>
    </html>
  );
}
