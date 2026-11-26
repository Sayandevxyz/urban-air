import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Urban Air Quality Assistant | Smog Navigation & Clean Routines",
  description:
    "Check live US and European AQI, severe winter smog alerts, personalized family health advice, indoor air hacks, sustainable routines, and grounded AI guidance.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Root HTML document shell declaring responsive viewport and theme support.
 */
export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-dvh bg-surface text-ink antialiased">{children}</body>
    </html>
  );
}
