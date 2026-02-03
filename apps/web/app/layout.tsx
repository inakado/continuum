import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Unbounded } from "next/font/google";
import "./globals.css";
import ThemeHydration from "@/components/ThemeHydration";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["300"],
});

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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
  try {
    const stored = localStorage.getItem("continuum-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
  } catch (err) {
    document.documentElement.dataset.theme = "light";
  }
})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} ${unbounded.variable}`}>
        <ThemeHydration />
        {children}
      </body>
    </html>
  );
}
