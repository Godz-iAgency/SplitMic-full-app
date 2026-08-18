import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "SplitMic | Music Industry Connected",
    template: "%s | SplitMic",
  },
  description:
    "SplitMic is Austin's music industry network, connecting bands, venues, talent buyers, festivals, and record labels on one platform.",
  applicationName: "SplitMic",
  appleWebApp: {
    capable: true,
    title: "SplitMic",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "SplitMic",
    title: "SplitMic | Austin's Music Industry",
    description:
      "Connect with Austin bands, venues, talent buyers, festivals, and labels.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FF6B35" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} scroll-smooth`}>
      <head>
        {/* Impact.com site verification for the Ticketmaster affiliate application.
            Impact's snippet uses a non-standard "value" attribute instead of
            "content", which React's <meta> typing doesn't allow — cast to render
            the exact attribute their verifier expects. */}
        <meta
          name="impact-site-verification"
          {...{ value: "e11d1960-fed4-4ea9-a8b6-24f60611ed39" }}
        />
      </head>
      <body className="min-h-screen overflow-x-clip bg-black text-white">
        {children}
        <ServiceWorkerRegister />
        <InstallPrompt />
      </body>
    </html>
  );
}
