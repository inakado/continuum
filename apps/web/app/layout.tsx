import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/unbounded/300.css";
import "@fontsource/unbounded/400.css";
import "@fontsource/unbounded/500.css";
import "@fontsource/unbounded/600.css";
import "@fontsource/unbounded/700.css";
import "./globals.css";
import "katex/dist/katex.min.css";
import ThemeHydration from "@/components/ThemeHydration";

export const metadata: Metadata = {
  title: "Континуум",
  description: "Консоль преподавателя",
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
        {children}
      </body>
    </html>
  );
}
