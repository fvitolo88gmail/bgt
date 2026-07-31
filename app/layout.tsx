import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";
import { InactivityLogout } from "@/components/auth/InactivityLogout";
import "./globals.css";

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BGT",
  description: "Assistente per regole di giochi da tavolo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="it" className={`${sora.variable} ${ibmPlexMono.variable} h-full antialiased`}>
      <body className="flex h-full flex-col" suppressHydrationWarning>
      <InactivityLogout />
      <Header />
      {/* overflow-y-auto (non hidden): pagine senza un proprio contenitore
          di scroll interno (profilo, home, ecc.) devono poter scrollare qui.
          La chat gestisce già il suo scroll con un div interno dedicato,
          quindi non ne risente — la sua altezza viene dal layout flex, non
          da questa proprietà. */}
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
      <Footer />
      </body>
      </html>
  );
}
