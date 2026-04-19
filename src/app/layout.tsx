import type { Metadata } from "next";
import { DM_Sans, Spectral, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

// Fonts reserved for the /preview routes — loaded as CSS variables only,
// not applied globally. Existing pages continue to use DM Sans via body.
const spectral = Spectral({
  variable: "--font-spectral",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Back Bar — Myatt's Fields",
  description: "Internal operations hub for Myatt's Fields Cocktails",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "The Back Bar",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${spectral.variable} ${inter.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full" style={{ background: "#F5F1EA", color: "#1A1815" }}>
        {children}
      </body>
    </html>
  );
}
