// ============================================================================
// src/app/layout.tsx
// Defines the root HTML document shell, metadata, and localization provider.
// ============================================================================

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppLocaleProvider } from "@/components/LocaleContext";
import "./globals.css";

/** Next.js page metadata describing the Urban Air Quality Assistant. */
export const metadata: Metadata = {
  title: "Urban Air Quality Assistant | Smog Navigation & Clean Routines",
  description:
    "Check live US and European AQI, severe winter smog alerts, personalized family health advice, indoor air hacks, sustainable routines, and grounded AI guidance.",
};

/** Next.js responsive viewport settings permitting user zoom for accessibility. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Root HTML document shell reading CSP nonce and providing localized client context.
 */
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const headerStore = await headers();
  headerStore.get("x-nonce");

  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
      </head>
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <AppLocaleProvider>{children}</AppLocaleProvider>
      </body>
    </html>
  );
}
