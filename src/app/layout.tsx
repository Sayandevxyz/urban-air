import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AppLocaleProvider } from "@/components/LocaleContext";
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
 * Root HTML document shell reading CSP nonce and providing localized client context.
 */
export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const headerStore = await headers();
  const nonce = headerStore.get("x-nonce") ?? undefined;

  return (
    <html lang="en">
      <head>
        <meta name="color-scheme" content="light dark" />
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
      </head>
      <body className="min-h-dvh bg-surface text-ink antialiased">
        <AppLocaleProvider>{children}</AppLocaleProvider>
      </body>
    </html>
  );
}
