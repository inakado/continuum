import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "medeo-font/sans.css";
import "@fontsource/unbounded/300.css";
import "./globals.css";
import ThemeHydration from "@/components/ThemeHydration";
import QueryProvider from "@/lib/query/query-provider";

export const metadata: Metadata = {
  title: "Континуум",
  description: "Закрытая библиотека занятий по физике",
  applicationName: "Континуум",
  manifest: "/site.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Континуум",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="ru" data-theme="light" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
  try {
    const stored = localStorage.getItem("continuum-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (err) {
    document.documentElement.dataset.theme = "light";
  }
})();`}
        </Script>
        <ThemeHydration />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
