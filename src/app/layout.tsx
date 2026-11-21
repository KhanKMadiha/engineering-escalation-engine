import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShellWithCounts } from "@/components/layout/AppShellWithCounts";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Engineering Escalation Engine",
  description:
    "Internal support operations platform for case investigation and engineering escalation decisions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        <AppShellWithCounts>{children}</AppShellWithCounts>
      </body>
    </html>
  );
}
