import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import BottomNav from "@/components/BottomNav";
import WardrobeInitializer from "@/components/WardrobeInitializer";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drippy — Editorial Wardrobe & Style Planner",
  description:
    "Curate your wardrobe with calm warm minimalist luxury. Offline-first lookbook and outfit planning.",
  keywords: ["wardrobe", "style planner", "lookbook", "minimalist fashion", "drippy"],
};

export const viewport: Viewport = {
  themeColor: "#F9F8F6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-[#EAE8E3] text-[#1A1A1A] flex justify-center selection:bg-[#2D3A2F] selection:text-[#F9F8F6]">
        {/* Centered mobile-first max-w-md container */}
        <div className="w-full max-w-md min-h-screen bg-[#F9F8F6] relative shadow-[0_0_50px_rgba(0,0,0,0.06)] border-x border-[#EAE7E1] flex flex-col">
          <WardrobeInitializer />
          <main className="flex-1 w-full pb-20">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
