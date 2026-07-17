import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/lib/leaflet-css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScrapIQ CI — Web Scraping Intelligent",
  description:
    "Plateforme SaaS de découverte et d'enrichissement automatique d'entreprises ivoiriennes. Recherche multicritère, scraping multi-sources, déduplication IA et cartographie.",
  keywords: [
    "web scraping",
    "Côte d'Ivoire",
    "entreprises",
    "B2B",
    "SaaS",
    "Abidjan",
    "data enrichment",
  ],
  authors: [{ name: "ScrapIQ CI" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ScrapIQ CI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <SonnerToaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
