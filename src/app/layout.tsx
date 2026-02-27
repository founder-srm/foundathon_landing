import type { Metadata } from "next";
import { JetBrains_Mono, Work_Sans } from "next/font/google";
import { Suspense } from "react";
import Header from "@/components/sections/Header";
import CustomCursor from "@/components/ui/custom-cursor";
import { MotionPreferencesProvider } from "@/components/ui/motion-preferences";
import {
  RouteProgressBar,
  RouteProgressProvider,
} from "@/components/ui/route-progress";
import { RouteTransition } from "@/components/ui/route-transition";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
// import { ThemeProvider } from "next-themes";

const geistSans = JetBrains_Mono({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Work_Sans({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://foundathon.thefoundersclub.tech"),
  title: "Foundathon 3.0 - The Founders Club",
  description:
    "Foundathon 3.0 is a three-day innovation marathon featuring a dual-stage competitive structure. Participants tackle specific challenges curated by industry partners, with track winners earning direct recognition from the respective organization. These track champions then advance to a grand finale to compete for the ultimate cash prize.",
  publisher: "Founders Club",
  classification:
    "Business / Entrepreneurship / Innovation / Hackathon / Startup Event",
  keywords: [
    "Foundathon 3.0",
    "Foundathon",
    "Founders Club",
    "Founders Club SRMIST",
    "SRMIST Foundathon",
    "SRM hackathon",
    "SRM University hackathon",
    "Kattankulathur hackathon",
    "startup hackathon India",
    "student hackathon India",
    "innovation marathon",
    "entrepreneurship event",
    "startup competition",
    "innovation challenge",
    "student entrepreneurship",
    "founder event",
    "startup event SRM",
    "venture building event",
    "product building hackathon",
    "innovation competition",
    "cash prize hackathon",
    "industry challenge hackathon",
    "youth innovation India",
    "tech and startup event",
    "Founders Club events",
  ],
  openGraph: {
    type: "website",
    url: "https://foundathon.thefoundersclub.tech",
    title: "Foundathon 3.0",
    description:
      "Foundathon 3.0 is a three-day innovation marathon featuring a dual-stage competitive structure. Participants tackle specific challenges curated by industry partners, with track winners earning direct recognition from the respective organization. These track champions then advance to a grand finale to compete for the ultimate cash prize.",
    siteName: "Foundathon 3.0",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Foundathon 3.0",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Foundathon 3.0 - The Founders Club",
    description:
      "Foundathon 3.0 is a three-day innovation marathon featuring a dual-stage competitive structure.",
    images: ["/opengraph-image.png"],
  },

  icons: {
    icon: [{ url: "/favicon.svg" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <link rel="shortcut icon" href="/logo.svg" type="image/x-icon" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased scroll-smooth`}
      >
        {/* <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        > */}
        <Suspense fallback={null}>
          <MotionPreferencesProvider>
            <RouteProgressProvider>
              <Header />
              <RouteProgressBar />
              <CustomCursor />
              <RouteTransition>{children}</RouteTransition>
              <Toaster />
            </RouteProgressProvider>
          </MotionPreferencesProvider>
        </Suspense>
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
