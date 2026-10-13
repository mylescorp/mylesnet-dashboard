import { Bricolage_Grotesque, Geist, Hanken_Grotesk, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import Script from "next/script";
import "@mylesnet/ui/styles.css";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage-grotesque",
  subsets: ["latin"],
  display: "swap",
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const instrumentSerif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"], display: "swap" });

/**
 * Resolves the client-readable theme cookie before first paint. The server also
 * renders the selected mode on html so the page begins with the correct theme.
 */
const themeScript = `(function() {
  const stored = document.cookie.split('; ').find((cookie) => cookie.startsWith('__mylesnet_theme='))?.split('=')[1];
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
      className={`${inter.variable} ${jetbrainsMono.variable} ${bricolage.variable} ${hanken.variable} ${geist.variable} ${instrumentSerif.variable}`}
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
