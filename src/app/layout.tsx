import type { Metadata } from "next";
import { Geist, Work_Sans } from "next/font/google";
import { Suspense } from "react";
import Header from "@/components/sections/Header";
import {
  RouteProgressBar,
  RouteProgressProvider,
} from "@/components/ui/route-progress";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";
// import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Work_Sans({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://foundthon.thefoundersclub.tech"),
  title: "Foundathon 3.0 - The Founders Club",
  description:
    "Foundathon 3.0 is a three-day innovation marathon featuring a dual-stage competitive structure. Participants tackle specific challenges curated by industry partners, with track winners earning direct recognition from the respective organization. These track champions then advance to a grand finale to compete for the ultimate cash prize.",
  openGraph: {
    type: "website",
    url: "https://foundthon.thefoundersclub.tech",
    title: "Foundathon 3.0",
    description:
      "Foundathon 3.0 is a three-day innovation marathon featuring a dual-stage competitive structure. Participants tackle specific challenges curated by industry partners, with track winners earning direct recognition from the respective organization. These track champions then advance to a grand finale to compete for the ultimate cash prize.",
    siteName: "Foundathon 3.0",
    images: [{ url: "/opengraph-image.png" }],
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
    <html lang="en" suppressHydrationWarning>
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
          <RouteProgressProvider>
            <Header />
            <RouteProgressBar />
            {children}
            <Toaster />
          </RouteProgressProvider>
        </Suspense>
        {/* </ThemeProvider> */}
      </body>
    </html>
  );
}
