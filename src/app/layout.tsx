import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const soehne = localFont({
  variable: "--font-soehne",
  display: "swap",
  src: [
    { path: "../../public/fonts/soehne-leicht.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/soehne-buch.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/soehne-buch-kursiv.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/soehne-kraftig.woff2", weight: "500", style: "normal" },
  ],
});

const adamcgPro = localFont({
  variable: "--font-adamcg-pro",
  display: "swap",
  src: [{ path: "../../public/fonts/adamcg-pro.woff2", weight: "400", style: "normal" }],
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
      className={`${soehne.variable} ${adamcgPro.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="min-h-full" style={{ background: "#F5F1EA", color: "#1A1815" }}>
        {children}
      </body>
    </html>
  );
}
