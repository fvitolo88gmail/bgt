import type { Metadata } from "next";
import { Sora, IBM_Plex_Mono } from "next/font/google";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";
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
      <Header />
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
      <Footer />
      </body>
      </html>
  );
}
