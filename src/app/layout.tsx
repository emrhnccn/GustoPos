import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "GustoPOS | Akıllı Cafe & Restoran Adisyon Sistemi",
  description: "Restoran ve kafeler için hızlı, güvenli, parçalı ödeme ve masa yönetimli yeni nesil POS sistemi.",
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
      <body className="min-h-full font-sans bg-[#0c0f17] text-slate-100 flex flex-col">
        {children}
      </body>
    </html>
  );
}
