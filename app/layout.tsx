import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { MotionConfig } from "motion/react";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/providers/smooth-scroll-provider";
import { SiteChrome } from "@/components/storefront/SiteChrome";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
  display: "swap",
});

const APP_URL =
  (process.env.APP_URL ?? "").trim() ||
  (process.env.NEXT_PUBLIC_APP_URL ?? "").trim() ||
  "http://localhost:3000";

const OG_IMAGE =
  "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: "Maison — Home & Living",
  description:
    "Maison — small-batch furniture, lighting and textiles, cash on delivery.",
  icons: { icon: "/favicon.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Maison",
    url: "/",
    title: "Maison — Home & Living",
    description:
      "Small-batch furniture, lighting and textiles — cash on delivery.",
    images: [{ url: OG_IMAGE, width: 1200, height: 800 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Maison — Home & Living",
    description:
      "Small-batch furniture, lighting and textiles — cash on delivery.",
    images: [OG_IMAGE],
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  themeColor: "#F7F3EC",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${grotesk.variable}`}>
      <body className="bg-paper text-ink font-sans antialiased">
        <MotionConfig reducedMotion="user">
          <SmoothScrollProvider>
            <SiteChrome>{children}</SiteChrome>
          </SmoothScrollProvider>
        </MotionConfig>
      </body>
    </html>
  );
}
