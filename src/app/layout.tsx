import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";
import BackgroundOrbs from "@/components/BackgroundOrbs";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

import type { Viewport } from "next";

export const metadata: Metadata = {
  title: "GustoPOS | Akıllı Cafe & Restoran Adisyon Sistemi",
  description: "Restoran ve kafeler için hızlı, güvenli, parçalı ödeme ve masa yönetimli yeni nesil POS sistemi.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GustoPOS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0c0f17",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${outfit.variable} ${inter.variable} dark h-full antialiased`}
    >
      <body className="min-h-full font-sans bg-[#0c0f17] text-zinc-100 flex flex-col">
        <BackgroundOrbs />
        {children}
      </body>
    </html>
  );
}
